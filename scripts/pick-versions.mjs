/**
 * Choisit, pour chaque paquet, la plus haute version stable publiée depuis au moins 14 jours
 * (règle du projet : stabilité, prudence face aux paquets compromis).
 * Usage : `node scripts/pick-versions.mjs vite dexie preact`
 */
const DAYS = 14;
const cutoff = new Date(Date.now() - DAYS * 86_400_000);

/** Comparaison semver simple (x.y.z). */
const cmp = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

await Promise.all(
  process.argv.slice(2).map(async (name) => {
    const res = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}`);
    const { time } = await res.json();
    const best = Object.entries(time)
      .filter(([v, d]) => /^\d+\.\d+\.\d+$/.test(v) && new Date(d) < cutoff)
      .map(([v]) => v)
      .sort(cmp)
      .at(-1);
    console.log(`${name} ${best} (${time[best]?.slice(0, 10)})`);
  }),
);
