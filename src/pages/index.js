import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const features = [
  {
    title: 'Dynamic scaling',
    description: 'Expand or shrink your Slurm node allocation at runtime — no restart required.',
  },
  {
    title: 'Policy-driven',
    description: 'Choose a built-in reconfiguration policy or implement your own with a simple C interface.',
  },
  {
    title: 'MPI-native',
    description: 'Integrates directly with Open MPI. Your existing MPI code keeps working.',
  },
  {
    title: 'Minimal API',
    description: 'Three functions: dmr_init, dmr_check, dmr_finalize. Plus the DMR_AUTO macro.',
  },
];

const news = [
  {
    date: 'June 2026',
    title: 'Accepted paper at PPAM 2026',
    description: 'Entitled: "Malleable Molecular Dynamics Simulations with GROMACS and DMR".',
  },
  {
    date: 'June 2026',
    title: 'DMR @ ISC High Performance 2026 in Hamburg (Germany)',
    description: 'Participating in the Birds of a Feather (BoF) session:"Sharing Experiences and Challenges in the Dynamic Use of Resources in HPC/AI".',
    link: 'https://isc-hpc.com/program/schedule',
  },
  {
    date: 'June 2026',
    title: 'DMR @ HPCKP 2026 in Barcelona (Spain)',
    description: 'Presenting: "Dynamic Resource Management in Quantum Circuit Simulations".',
    link: 'https://hpckp.org/annual-meeting/agenda/annual-meeting/dynamic-resource-management-in-quantum-circuit-simulations/',
  },
];

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>DMR</h1>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.heroButtons}>
            <Link className="button button--primary button--lg" to="/getting-started/what-is-dmr">
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to="https://gitlab.bsc.es/accelcom/releases/dmr/dmr">
              GitLab
            </Link>
          </div>
        </div>

        <div className={styles.news}>
          <h2 className={styles.newsTitle}>Latest News</h2>
          <div className="container">
            <div className="row">
              {news.map(({date, title, description, link}) => (
                <div key={title} className="col col--3">
                  <div className={styles.newsCard}>
                    <span className={styles.newsDate}>{date}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    {link && (
                      <Link className={styles.newsLink} to={link}>
                        Read more →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.features}>
          <h2 className={styles.featuresTitle}>Key Features</h2>
          <div className="container">
            <div className="row">
              {features.map(({title, description}) => (
                <div key={title} className="col col--3">
                  <div className={styles.featureCard}>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
