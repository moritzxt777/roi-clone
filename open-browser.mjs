import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

puppeteer.use(StealthPlugin());

(async () => {
  console.log('Iniciando navegador físico...');
  const browser = await puppeteer.launch({ 
    headless: false, // Abre o navegador na tela do usuário!
    defaultViewport: { width: 1366, height: 768 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navegando para o login...');
    await page.goto('https://app.arktrix.app/auth', { waitUntil: 'domcontentloaded' });
    
    // Esperar um pouco para garantir que a página carregou
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Procurando campos de login...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'moritzdoblack@proton.me', { delay: 50 });
    
    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', '12345678A@', { delay: 50 });
    
    console.log('Clicando em entrar...');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.toLowerCase().includes('entrar') || text.toLowerCase().includes('login') || text.toLowerCase().includes('sign in')) {
        await btn.click();
        break;
      }
    }
    // Caso não ache por texto, tenta o submit direto se houver
    await page.click('button[type="submit"]').catch(() => {});
    
    console.log('Aguardando carregamento do painel...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('Tirando print da tela...');
    await page.screenshot({ path: 'painel_arktrix_real.png', fullPage: true });
    
    console.log('Extraindo textos da página para analisar funcionalidades...');
    const text = await page.evaluate(() => document.body.innerText);
    writeFileSync('painel_arktrix_texto.txt', text);
    
    console.log('Sucesso!');
  } catch (error) {
    console.error('Erro durante a navegação:', error);
    await page.screenshot({ path: 'erro_arktrix.png' });
  } finally {
    await browser.close();
  }
})();
