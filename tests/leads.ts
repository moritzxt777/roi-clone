/**
 * Tests for lead capture: form wiring, field normalisation, e-mail rendering
 * safety and JSON coercion.
 *
 * Each case maps to a specific failure that was possible before this code
 * existed: a form left pointing at the original operator, a lead silently
 * dropped by a Prisma rejection, a lead-controlled value breaking out of the
 * e-mail template, and a visitor with JavaScript disabled losing their
 * submission.
 */

import { wireCloneForms, parseFormEncoded, HONEYPOT_FIELD } from '../src/lib/clone-forms';
import { normalizeLeadFields, extractLeadEmail, escapeHtml } from '../src/lib/lead-mail';
import { toStorableJson, asPrismaJson } from '../src/lib/json-coerce';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed++;
    return;
  }
  failed++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, Object.is(actual, expected), `esperado ${String(expected)}, obtido ${String(actual)}`);
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ---------------------------------------------------------------------------

section('Form wiring — o form deixa de submeter no site original');
{
  const original = `<!DOCTYPE html><html><head><title>Original</title></head>
<body>
  <form action="https://site-original.com/lead" method="POST" onsubmit="return valida()">
    <input name="nome" type="text" required>
    <input name="email" type="email" required>
    <input name="tel" type="tel">
    <input type="checkbox" name="interesses" value="fitness">
    <select name="pais"><option value="BR" selected>Brasil</option></select>
    <button type="submit">Quero me inscrever</button>
  </form>
</body></html>`;

  const endpoint = 'https://roi-clone.site/api/pages/pag_abc123/form-submissions';
  const result = wireCloneForms(original, { endpoint, sourceUrl: 'https://site-original.com/x' });

  equal('um form foi religado', result.formCount, 1);
  check(
    'action deixou de apontar para o site original',
    !result.html.includes('action="https://site-original.com/lead"')
  );
  check('action aponta para o endpoint local', result.html.includes(`action="${endpoint}"`));
  check('método é POST', /action="[^"]+"[^>]*method="POST"/.test(result.html) || result.html.includes('method="POST"'));
  check('o form foi marcado para o interceptor', result.html.includes('data-roi-form="1"'));
  check('o onsubmit original foi preservado', result.html.includes('onsubmit="return valida()"'));
  check('os inputs originais sobreviveram', result.html.includes('name="nome"') && result.html.includes('name="email"'));
  check('o select sobreviveu com o valor marcado', result.html.includes('value="BR" selected') || result.html.includes('selected="selected"'));
  check('o botão original sobreviveu', result.html.includes('Quero me inscrever'));
  check('o script do interceptor foi injetado', result.html.includes('roi-form-bridge'));
  check('o honeypot foi injetado', result.html.includes(HONEYPOT_FIELD));
  check('o honeypot é invisível para o usuário', result.html.includes('left:-9999px'));
  check('a confirmação sem-JS foi injetada', result.html.includes('roi_enviado'));
}

section('Form wiring — forms que não devem ser tocados');
{
  // Policy: a form is rewired unless it is clearly a search or filter. A missed
  // rewiring loses a lead outright, while an extra rewired filter form costs the
  // owner one junk row — the asymmetry decides it.
  const searchGet = `<html><body><form action="/busca" method="GET"><input type="search" name="q"><button>Pesquisar</button></form></body></html>`;
  const untouched = wireCloneForms(searchGet, { endpoint: 'https://x.test/api' });
  equal('form com method=GET nunca é religada', untouched.formCount, 0);
  check('a action original do GET foi mantida', untouched.html.includes('action="/busca"'));
  check('e nada foi injetado', !untouched.html.includes('roi-form-bridge'));

  const searchByName = `<html><body><form action="/busca"><input name="q"><button>Buscar agora</button></form></body></html>`;
  equal('form de busca reconhecida pelo nome do campo e do botão', wireCloneForms(searchByName, { endpoint: 'https://x.test/api' }).formCount, 0);

  const empty = `<html><body><form><div>Nada aqui</div></form></body></html>`;
  const skipped = wireCloneForms(empty, { endpoint: 'https://x.test/api' });
  equal('form sem campo nenhum é pulado', skipped.formCount, 0);
  equal('e contabilizado como pulado', skipped.skipped, 1);

  const none = `<html><body><h1>Sem form</h1></body></html>`;
  const noForms = wireCloneForms(none, { endpoint: 'https://x.test/api' });
  equal('página sem form', noForms.formCount, 0);
  check('e nada foi injetado', !noForms.html.includes('roi-form-bridge'));

  // A lead form with unusual wording is still captured, because the cost of
  // skipping it is a lost sale.
  const unusual = `<html><body><form action="/x"><input name="pessoa"><button>Prosseguir</button></form></body></html>`;
  equal('form com rótulo fora do padrão é capturada mesmo assim', wireCloneForms(unusual, { endpoint: 'https://x.test/api' }).formCount, 1);
}

section('Form wiring — várias forms e honeypot único');
{
  const two = `<html><body>
    <form action="/a" method="POST"><input name="a1"><button>Quero me inscrever</button></form>
    <form action="/b" method="POST"><input name="b1"><button>Garantir vaga</button></form>
  </body></html>`;
  const result = wireCloneForms(two, { endpoint: 'https://x.test/api' });
  equal('duas forms religadas', result.formCount, 2);

  const occurrences = result.html.split(`name="${HONEYPOT_FIELD}"`).length - 1;
  equal('o honeypot aparece exatamente uma vez', occurrences, 1);

  const bridgeOccurrences = result.html.split('id="roi-form-bridge"').length - 1;
  equal('o interceptor aparece exatamente uma vez', bridgeOccurrences, 1);
}

section('Form wiring — o endpoint não pode escapar do script');
{
  // The endpoint is interpolated into a `<script>` block, so it has to survive
  // two independent attacks: closing the tag, and breaking out of the string.
  // `new URL()` percent-encodes the characters that can end a tag; JSON.stringify
  // handles the quote. Both defences are asserted separately.
  const cases: Array<[string, string]> = [
    ['fecha a tag', 'https://x.test/</script><script>alert(1)</script>'],
    ['quebra a string', 'https://roi-clone.site/";alert(1);//'],
    ['template literal', 'https://x.test/${alert(1)}'],
    ['quebra de linha', 'https://x.test/a\nb'],
  ];

  for (const [label, hostile] of cases) {
    const result = wireCloneForms(
      `<html><body><form method="POST"><input name="x"></form></body></html>`,
      { endpoint: hostile, sourceUrl: 'https://orig.test/' }
    );

    const start = result.html.indexOf('var ENDPOINT =');
    const line = result.html.slice(start, result.html.indexOf('\n', start));

    check(`${label}: a linha é uma atribuição de string terminada`,
      /^var ENDPOINT = ".*";\s*$/.test(line), line.slice(0, 150));
    check(`${label}: nenhum < ou > cru escapou para a tag`,
      !line.includes('<') && !line.includes('>'), line.slice(0, 150));
    check(`${label}: o payload não injeta um novo <script>`,
      (result.html.match(/<script/g) || []).length <= 2,
      `scripts=${(result.html.match(/<script/g) || []).length}`);

    // The strongest check: the value must not contain a sequence that would end
    // the block early.
    const beforeBridge = result.html.slice(0, result.html.indexOf('id="roi-form-bridge"'));
    const closers = (beforeBridge.match(/<\/script>/g) || []).length;
    check(`${label}: nada encerra o bloco antes da hora`, closers === 0, `closers=${closers}`);
  }
}

section('Form wiring — caminho sem JavaScript');
{
  const parsed = parseFormEncoded('a=1&b=2&a=3');
  equal('chave repetida vira lista separada por vírgula', parsed.a, '1, 3');
  equal('as demais chaves seguem intactas', parsed.b, '2');
  equal('valor com espaço é decodificado', parseFormEncoded('nome=Jo%C3%A3o+Silva').nome, 'João Silva');
  equal('chave vazia é ignorada', Object.keys(parseFormEncoded('=1')).length, 0);
}

// ---------------------------------------------------------------------------

section('Normalização de campos — nada se perde');
{
  const fields = normalizeLeadFields({
    nome: 'João Silva',
    email: 'joao@exemplo.com.br',
    telefone: '+55 11 98888-7777',
    'data-nascimento': '1990-05-14',
    interesses: ['fitness', 'emagrecimento'],
    endereco: { rua: 'Rua A', numero: '120', cidade: 'São Paulo' },
    aceito: true,
    observacoes: '  Quero saber mais sobre o método  ',
    vazio: '',
    nulo: null,
  });

  const byName = new Map(fields.map((f) => [f.name, f]));

  equal('"nome" vira rótulo legível', byName.get('nome')?.label, 'Nome');
  equal('e-mail é classificado', byName.get('email')?.kind, 'email');
  equal('telefone é classificado', byName.get('telefone')?.kind, 'phone');
  equal('data-nascimento tem rótulo em português', byName.get('data-nascimento')?.label, 'Data de nascimento');
  equal('lista vira uma linha', byName.get('interesses')?.value, 'fitness, emagrecimento');
  equal('checkbox marcado vira Sim', byName.get('aceito')?.value, 'Sim');
  equal('valor é aparado', byName.get('observacoes')?.value, 'Quero saber mais sobre o método');
  check('campo vazio é descartado', !byName.has('vazio'));
  check('campo nulo é descartado', !byName.has('nulo'));

  check('objeto aninhado é achatado, não perdido', byName.has('endereco.rua'), JSON.stringify(fields.map((f) => f.name)));
  equal('e o valor aninhado sobreviveu', byName.get('endereco.rua')?.value, 'Rua A');
  equal('o mapa de e-mail é preservado', byName.get('email')?.value, 'joao@exemplo.com.br');
}

section('Normalização — limites');
{
  const huge = 'A'.repeat(9000);
  const fields = normalizeLeadFields({ comentario: huge });
  check('valor gigante é truncado', fields[0].value.length < 2100, `len=${fields[0].value.length}`);
  check('e marcado como truncado', fields[0].value.includes('truncado'));

  const many: Record<string, string> = {};
  for (let i = 0; i < 300; i++) many[`campo_${i}`] = String(i);
  equal('campos duplicados são colapsados', normalizeLeadFields(many).length, 300);
}

section('Extração de e-mail do lead');
{
  const good = normalizeLeadFields({ nome: 'X', email: 'lead@exemplo.com' });
  equal('e-mail válido é extraído', extractLeadEmail(good), 'lead@exemplo.com');

  const bad = normalizeLeadFields({ email: 'nao-e-um-email' });
  equal('valor inválido não vira Reply-To', extractLeadEmail(bad), null);

  const none = normalizeLeadFields({ nome: 'X' });
  equal('sem campo de e-mail, nada é extraído', extractLeadEmail(none), null);

  const nasty = normalizeLeadFields({ email: 'a@b.co\r\nBcc: vitima@outro.test' });
  equal('tentativa de injetar header é rejeitada', extractLeadEmail(nasty), null);
}

section('Escape de HTML');
{
  equal('escapa < > " &', escapeHtml('<img src=x onerror="a&b">'), '&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;');
  equal('escapa aspas simples', escapeHtml("it's"), 'it&#039;s');
  equal('não altera texto sem marcação', escapeHtml('texto normal'), 'texto normal');
}

// ---------------------------------------------------------------------------

section('Coerção para JSON — o banco não pode rejeitar um lead');
{
  const circular: Record<string, unknown> = { nome: 'X' };
  circular.self = circular;

  const coerced = toStorableJson({
    nome: 'João',
    idade: 30,
    ativo: true,
    nada: null,
    indefinido: undefined,
    funcao: () => 'x',
    naoNumero: Number.NaN,
    infinito: Number.POSITIVE_INFINITY,
    grande: 10n,
    data: new Date('2024-03-11T14:22:33Z'),
    erro: new Error('falhou'),
    lista: [1, 'dois', true, null],
    objeto: { aninhado: { fundo: 'valor' } },
    circular,
  });

  equal('string preservada', coerced.nome, 'João');
  equal('número preservado', coerced.idade, 30);
  equal('boolean preservado', coerced.ativo, true);
  equal('null preservado', coerced.nada, null);
  equal('undefined vira null, não some', coerced.indefinido, null);
  equal('função vira null', coerced.funcao, null);
  equal('NaN vira string, porque JSON não tem NaN', coerced.naoNumero, 'NaN');
  equal('Infinity vira string', coerced.infinito, 'Infinity');
  equal('BigInt vira string', coerced.grande, '10');
  equal('Date vira ISO', coerced.data, '2024-03-11T14:22:33.000Z');
  equal('Error vira mensagem', coerced.erro, 'falhou');
  check('lista preservada', Array.isArray(coerced.lista) && coerced.lista.length === 4);
  check('objeto aninhado preservado', JSON.stringify(coerced.objeto).includes('fundo'));
  check('ciclo não trava: a profundidade corta', JSON.stringify(coerced.circular).length < 500);

  // The real point: the result has to survive JSON.stringify, which is what a
  // jsonb round trip amounts to.
  let serialised: string | null = null;
  try {
    serialised = JSON.stringify(coerced);
  } catch (error) {
    serialised = `THREW: ${(error as Error).message}`;
  }
  check('o resultado serializa sem erro', serialised !== null && !serialised.startsWith('THREW'), serialised ?? '');

  // And it has to round-trip through the same parse, unchanged.
  check(
    'e volta idêntico do parse',
    JSON.stringify(JSON.parse(serialised as string)) === serialised
  );
}

section('Coerção — arrays e chaves em excesso');
{
  const hugeArray = Array.from({ length: 1000 }, (_, i) => i);
  const coerced = toStorableJson({ lista: hugeArray });
  check('array gigante é truncado', (coerced.lista as unknown[]).length <= 201);

  const manyKeys: Record<string, number> = {};
  for (let i = 0; i < 500; i++) manyKeys[`k${i}`] = i;
  const coercedKeys = toStorableJson(manyKeys);
  check('muitas chaves são truncadas', Object.keys(coercedKeys).length <= 201);
  check('e a truncagem é declarada', '__truncado' in coercedKeys);

  const deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let i = 0; i < 40; i++) {
    const next: Record<string, unknown> = {};
    cursor.nivel = next;
    cursor = next;
  }
  const deepCoerced = toStorableJson({ arvore: deep });
  check('estrutura profunda é cortada, não estoura a pilha', JSON.stringify(deepCoerced).length < 2000);
}

section('Coerção — casting para o Prisma');
{
  const asPrisma = asPrismaJson(toStorableJson({ a: 1, b: null, c: 'x' }));
  equal('o cast devolve um objeto', typeof asPrisma, 'object');
  equal('com o conteúdo intacto', JSON.stringify(asPrisma), '{"a":1,"b":null,"c":"x"}');
}

// ---------------------------------------------------------------------------

console.log(`\n\x1b[1mResultado\x1b[0m`);
console.log(`  \x1b[32mpassou: ${passed}\x1b[0m   \x1b[31mfalhou: ${failed}\x1b[0m`);
if (failures.length > 0) {
  console.log('\n\x1b[31mFalhas:\x1b[0m');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
