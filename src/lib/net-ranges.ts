/**
 * Published network ranges the cloaker reasons about.
 *
 * These lists change. Meta and Google publish their crawler netblocks; the
 * cloud provider entries below are the large public allocations, not the
 * per-account subnets. Re-derive before a campaign launch and after any block
 * causes a drop in leads — an over-broad entry here costs real conversions,
 * which is the one failure mode this module is designed to avoid.
 *
 * Deliberate omission: ByteDance/TikTok does not publish a stable netblock list.
 * Guessing ranges would block paying traffic, so TikTok is detected by
 * User-Agent and by PTR (`*.bytedance.com`) instead. Absence here is a
 * decision, not an oversight.
 *
 * Source of truth to re-check:
 *   Meta   — https://developers.facebook.com/docs/facebook-ip-ranges
 *   Google — https://developers.google.com/search/crawlers/docs/verifying-googlebot
 *   Cloud  — provider ip-ranges.json feeds (aws, gcp, azure, do, hetzner, ovh, vultr, linode, oracle)
 */

export interface NetworkRange {
  label: string;
  cidr: string;
}

/**
 * Ad-platform infrastructure. Traffic from these ranges is either a crawler or
 * a member of the trust-and-safety review team. A converting lead never
 * originates here, so a hit is a hard block with no false-positive risk.
 */
export const AD_VERIFIER_NETWORKS: ReadonlyArray<NetworkRange> = Object.freeze([
  // Meta / Facebook
  { label: 'Meta/Facebook', cidr: '157.240.0.0/16' },
  { label: 'Meta/Facebook', cidr: '31.13.24.0/21' },
  { label: 'Meta/Facebook', cidr: '31.13.64.0/18' },
  { label: 'Meta/Facebook', cidr: '66.220.144.0/20' },
  { label: 'Meta/Facebook', cidr: '69.63.176.0/20' },
  { label: 'Meta/Facebook', cidr: '69.171.224.0/19' },
  { label: 'Meta/Facebook', cidr: '74.119.76.0/22' },
  { label: 'Meta/Facebook', cidr: '102.132.96.0/20' },
  { label: 'Meta/Facebook', cidr: '129.134.0.0/17' },
  { label: 'Meta/Facebook', cidr: '163.70.128.0/17' },
  { label: 'Meta/Facebook', cidr: '173.252.64.0/18' },
  { label: 'Meta/Facebook', cidr: '179.60.192.0/22' },
  { label: 'Meta/Facebook', cidr: '185.60.216.0/22' },
  { label: 'Meta/Facebook', cidr: '204.15.20.0/22' },

  // Google
  { label: 'Google', cidr: '66.249.64.0/19' },
  { label: 'Google', cidr: '66.249.128.0/19' },
  { label: 'Google', cidr: '66.249.192.0/20' },
  { label: 'Google', cidr: '66.249.208.0/20' },
  { label: 'Google', cidr: '66.249.224.0/19' },
  { label: 'Google', cidr: '66.249.240.0/20' },
  { label: 'Google', cidr: '172.217.0.0/16' },
  { label: 'Google', cidr: '142.250.0.0/15' },
  { label: 'Google', cidr: '192.158.28.0/22' },
  { label: 'Google', cidr: '216.58.192.0/19' },
  { label: 'Google', cidr: '23.236.48.0/20' },
  { label: 'Google', cidr: '23.251.128.0/19' },
  { label: 'Google', cidr: '173.255.112.0/20' },
  { label: 'Google', cidr: '35.208.0.0/12' },
  { label: 'Google', cidr: '35.224.0.0/12' },
  { label: 'Google', cidr: '34.64.0.0/10' },
  { label: 'Google', cidr: '35.192.0.0/12' },
  { label: 'Google', cidr: '35.196.0.0/14' },
  { label: 'Google', cidr: '35.200.0.0/13' },
  { label: 'Google', cidr: '35.214.0.0/16' },
  { label: 'Google', cidr: '35.198.0.0/16' },
  { label: 'Google', cidr: '35.199.0.0/17' },
  { label: 'Google', cidr: '104.196.0.0/14' },
  { label: 'Google', cidr: '104.197.0.0/16' },
  { label: 'Google', cidr: '130.211.0.0/16' },
  { label: 'Google', cidr: '162.216.148.0/22' },
  { label: 'Google', cidr: '162.222.176.0/21' },
  { label: 'Google', cidr: '199.192.112.0/22' },
  { label: 'Google', cidr: '199.223.232.0/21' },
  { label: 'Google', cidr: '208.68.108.0/22' },

  // Microsoft / Bing
  { label: 'Microsoft/Bing', cidr: '157.55.0.0/16' },
  { label: 'Microsoft/Bing', cidr: '204.79.197.0/24' },
]);

/**
 * Cloud and hosting providers. A datacenter origin is a signal, not a verdict:
 * corporate VPNs, CGNAT and some mobile ISPs publish addresses inside these
 * blocks. The engine only converts this into a block when a second signal
 * agrees, so the list can stay broad without costing leads.
 */
export const DATACENTER_NETWORKS: ReadonlyArray<NetworkRange> = Object.freeze([
  // AWS — partial coverage of the largest public allocations; PTR catches the rest.
  { label: 'AWS', cidr: '3.0.0.0/9' },
  { label: 'AWS', cidr: '13.32.0.0/15' },
  { label: 'AWS', cidr: '13.36.0.0/14' },
  { label: 'AWS', cidr: '15.177.0.0/16' },
  { label: 'AWS', cidr: '18.128.0.0/9' },
  { label: 'AWS', cidr: '34.192.0.0/12' },
  { label: 'AWS', cidr: '52.0.0.0/11' },
  { label: 'AWS', cidr: '52.88.0.0/13' },
  { label: 'AWS', cidr: '52.192.0.0/11' },
  { label: 'AWS', cidr: '54.64.0.0/11' },
  { label: 'AWS', cidr: '54.80.0.0/12' },
  { label: 'AWS', cidr: '54.144.0.0/12' },
  { label: 'AWS', cidr: '54.160.0.0/12' },
  { label: 'AWS', cidr: '54.192.0.0/12' },
  { label: 'AWS', cidr: '54.224.0.0/12' },
  { label: 'AWS', cidr: '63.32.0.0/14' },
  { label: 'AWS', cidr: '67.202.0.0/18' },
  { label: 'AWS', cidr: '70.132.0.0/17' },
  { label: 'AWS', cidr: '75.101.128.0/17' },
  { label: 'AWS', cidr: '76.20.0.0/14' },
  { label: 'AWS', cidr: '99.80.0.0/15' },
  { label: 'AWS', cidr: '100.20.0.0/14' },
  { label: 'AWS', cidr: '107.20.0.0/14' },
  { label: 'AWS', cidr: '174.129.0.0/16' },
  { label: 'AWS', cidr: '175.41.128.0/17' },
  { label: 'AWS', cidr: '176.32.0.0/11' },
  { label: 'AWS', cidr: '177.71.128.0/17' },
  { label: 'AWS', cidr: '184.72.64.0/18' },
  { label: 'AWS', cidr: '184.72.128.0/17' },
  { label: 'AWS', cidr: '184.73.0.0/16' },
  { label: 'AWS', cidr: '204.236.192.0/18' },
  { label: 'AWS', cidr: '216.182.224.0/20' },

  // Azure
  { label: 'Azure', cidr: '13.64.0.0/11' },
  { label: 'Azure', cidr: '13.104.0.0/14' },
  { label: 'Azure', cidr: '20.36.0.0/14' },
  { label: 'Azure', cidr: '20.40.0.0/13' },
  { label: 'Azure', cidr: '20.48.0.0/12' },
  { label: 'Azure', cidr: '20.64.0.0/10' },
  { label: 'Azure', cidr: '20.128.0.0/9' },
  { label: 'Azure', cidr: '40.64.0.0/10' },
  { label: 'Azure', cidr: '51.4.0.0/15' },
  { label: 'Azure', cidr: '51.8.0.0/16' },
  { label: 'Azure', cidr: '51.10.0.0/15' },
  { label: 'Azure', cidr: '51.12.0.0/15' },
  { label: 'Azure', cidr: '52.96.0.0/12' },
  { label: 'Azure', cidr: '52.112.0.0/14' },
  { label: 'Azure', cidr: '52.120.0.0/14' },
  { label: 'Azure', cidr: '65.52.0.0/14' },
  { label: 'Azure', cidr: '70.37.0.0/17' },
  { label: 'Azure', cidr: '104.40.0.0/13' },
  { label: 'Azure', cidr: '104.146.0.0/15' },
  { label: 'Azure', cidr: '104.208.0.0/13' },
  { label: 'Azure', cidr: '137.116.0.0/15' },
  { label: 'Azure', cidr: '138.91.0.0/16' },
  { label: 'Azure', cidr: '168.61.0.0/16' },
  { label: 'Azure', cidr: '168.62.0.0/15' },
  { label: 'Azure', cidr: '191.232.0.0/13' },
  { label: 'Azure', cidr: '207.46.0.0/16' },

  // DigitalOcean
  { label: 'DigitalOcean', cidr: '104.131.0.0/16' },
  { label: 'DigitalOcean', cidr: '104.236.0.0/16' },
  { label: 'DigitalOcean', cidr: '138.68.0.0/16' },
  { label: 'DigitalOcean', cidr: '138.197.0.0/16' },
  { label: 'DigitalOcean', cidr: '143.198.0.0/16' },
  { label: 'DigitalOcean', cidr: '159.65.0.0/16' },
  { label: 'DigitalOcean', cidr: '159.89.0.0/16' },
  { label: 'DigitalOcean', cidr: '164.90.0.0/16' },
  { label: 'DigitalOcean', cidr: '164.92.0.0/16' },
  { label: 'DigitalOcean', cidr: '167.71.0.0/16' },
  { label: 'DigitalOcean', cidr: '167.99.0.0/16' },
  { label: 'DigitalOcean', cidr: '170.64.0.0/16' },
  { label: 'DigitalOcean', cidr: '174.138.0.0/16' },
  { label: 'DigitalOcean', cidr: '178.62.0.0/16' },
  { label: 'DigitalOcean', cidr: '188.166.0.0/16' },
  { label: 'DigitalOcean', cidr: '188.226.0.0/16' },
  { label: 'DigitalOcean', cidr: '192.34.56.0/21' },
  { label: 'DigitalOcean', cidr: '192.81.208.0/20' },
  { label: 'DigitalOcean', cidr: '192.241.128.0/17' },
  { label: 'DigitalOcean', cidr: '206.189.0.0/16' },
  { label: 'DigitalOcean', cidr: '209.97.128.0/18' },
  { label: 'DigitalOcean', cidr: '2604:a880::/32' },

  // Hetzner
  { label: 'Hetzner', cidr: '5.9.0.0/16' },
  { label: 'Hetzner', cidr: '78.46.0.0/15' },
  { label: 'Hetzner', cidr: '88.198.0.0/16' },
  { label: 'Hetzner', cidr: '91.198.174.0/24' },
  { label: 'Hetzner', cidr: '94.130.32.0/19' },
  { label: 'Hetzner', cidr: '95.216.0.0/13' },
  { label: 'Hetzner', cidr: '116.203.0.0/16' },
  { label: 'Hetzner', cidr: '135.243.0.0/16' },
  { label: 'Hetzner', cidr: '136.243.0.0/16' },
  { label: 'Hetzner', cidr: '138.201.0.0/16' },
  { label: 'Hetzner', cidr: '144.76.0.0/16' },
  { label: 'Hetzner', cidr: '193.107.16.0/20' },
  { label: 'Hetzner', cidr: '2a01:4f8::/29' },
  { label: 'Hetzner', cidr: '2a01:4f9::/29' },

  // Vultr
  { label: 'Vultr', cidr: '45.32.0.0/12' },
  { label: 'Vultr', cidr: '45.63.0.0/16' },
  { label: 'Vultr', cidr: '45.76.0.0/14' },
  { label: 'Vultr', cidr: '45.77.0.0/16' },
  { label: 'Vultr', cidr: '66.42.0.0/16' },
  { label: 'Vultr', cidr: '95.179.128.0/17' },
  { label: 'Vultr', cidr: '104.156.224.0/19' },
  { label: 'Vultr', cidr: '108.61.0.0/16' },
  { label: 'Vultr', cidr: '136.244.64.0/18' },
  { label: 'Vultr', cidr: '140.82.0.0/18' },
  { label: 'Vultr', cidr: '149.28.0.0/16' },
  { label: 'Vultr', cidr: '199.247.0.0/16' },
  { label: 'Vultr', cidr: '207.148.0.0/17' },
  { label: 'Vultr', cidr: '209.222.16.0/20' },
  { label: 'Vultr', cidr: '216.155.128.0/18' },
  { label: 'Vultr', cidr: '2a03:4e0::/32' },

  // Linode / Akamai
  { label: 'Linode', cidr: '50.116.0.0/18' },
  { label: 'Linode', cidr: '66.175.208.0/20' },
  { label: 'Linode', cidr: '69.164.192.0/18' },
  { label: 'Linode', cidr: '72.14.176.0/20' },
  { label: 'Linode', cidr: '96.126.96.0/19' },
  { label: 'Linode', cidr: '97.107.128.0/19' },
  { label: 'Linode', cidr: '106.187.32.0/19' },
  { label: 'Linode', cidr: '139.144.0.0/16' },
  { label: 'Linode', cidr: '139.162.0.0/16' },
  { label: 'Linode', cidr: '143.42.0.0/16' },
  { label: 'Linode', cidr: '170.187.0.0/16' },
  { label: 'Linode', cidr: '172.104.0.0/15' },
  { label: 'Linode', cidr: '192.46.208.0/20' },
  { label: 'Linode', cidr: '192.53.160.0/20' },
  { label: 'Linode', cidr: '192.155.80.0/20' },
  { label: 'Linode', cidr: '198.58.96.0/19' },
  { label: 'Linode', cidr: '206.126.192.0/18' },
  { label: 'Linode', cidr: '2600:3c00::/32' },

  // OVH
  { label: 'OVH', cidr: '51.68.0.0/14' },
  { label: 'OVH', cidr: '51.80.0.0/15' },
  { label: 'OVH', cidr: '51.84.0.0/15' },
  { label: 'OVH', cidr: '51.91.0.0/16' },
  { label: 'OVH', cidr: '51.158.0.0/15' },
  { label: 'OVH', cidr: '51.255.0.0/16' },
  { label: 'OVH', cidr: '54.36.0.0/14' },
  { label: 'OVH', cidr: '54.39.0.0/16' },
  { label: 'OVH', cidr: '80.67.160.0/20' },
  { label: 'OVH', cidr: '80.73.0.0/20' },
  { label: 'OVH', cidr: '87.98.128.0/17' },
  { label: 'OVH', cidr: '87.253.128.0/17' },
  { label: 'OVH', cidr: '91.90.0.0/16' },
  { label: 'OVH', cidr: '92.222.0.0/15' },
  { label: 'OVH', cidr: '109.128.0.0/11' },
  { label: 'OVH', cidr: '109.160.0.0/12' },
  { label: 'OVH', cidr: '129.250.0.0/16' },
  { label: 'OVH', cidr: '142.117.0.0/16' },
  { label: 'OVH', cidr: '149.54.0.0/17' },
  { label: 'OVH', cidr: '149.126.0.0/17' },
  { label: 'OVH', cidr: '178.32.0.0/12' },
  { label: 'OVH', cidr: '178.128.0.0/12' },
  { label: 'OVH', cidr: '185.228.0.0/14' },
  { label: 'OVH', cidr: '188.165.0.0/16' },
  { label: 'OVH', cidr: '192.31.196.0/22' },
  { label: 'OVH', cidr: '193.70.0.0/17' },
  { label: 'OVH', cidr: '195.66.0.0/16' },
  { label: 'OVH', cidr: '213.32.0.0/14' },
  { label: 'OVH', cidr: '213.186.32.0/19' },

  // Oracle Cloud
  { label: 'Oracle Cloud', cidr: '129.146.0.0/16' },
  { label: 'Oracle Cloud', cidr: '130.35.0.0/16' },
  { label: 'Oracle Cloud', cidr: '130.61.0.0/16' },
  { label: 'Oracle Cloud', cidr: '132.145.0.0/16' },
  { label: 'Oracle Cloud', cidr: '138.1.0.0/16' },
  { label: 'Oracle Cloud', cidr: '140.91.0.0/16' },
  { label: 'Oracle Cloud', cidr: '141.144.0.0/16' },
  { label: 'Oracle Cloud', cidr: '143.47.0.0/16' },
  { label: 'Oracle Cloud', cidr: '144.24.0.0/16' },
  { label: 'Oracle Cloud', cidr: '146.56.0.0/16' },
  { label: 'Oracle Cloud', cidr: '147.154.0.0/16' },
  { label: 'Oracle Cloud', cidr: '150.136.0.0/16' },
  { label: 'Oracle Cloud', cidr: '152.67.0.0/16' },
  { label: 'Oracle Cloud', cidr: '158.101.0.0/16' },
  { label: 'Oracle Cloud', cidr: '158.180.0.0/16' },
  { label: 'Oracle Cloud', cidr: '192.9.128.0/17' },
  { label: 'Oracle Cloud', cidr: '192.16.0.0/15' },
  { label: 'Oracle Cloud', cidr: '192.18.0.0/15' },
  { label: 'Oracle Cloud', cidr: '193.122.0.0/15' },
  { label: 'Oracle Cloud', cidr: '198.45.0.0/16' },
  { label: 'Oracle Cloud', cidr: '212.147.0.0/16' },
]);
