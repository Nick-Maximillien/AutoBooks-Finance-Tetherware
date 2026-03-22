import Image from 'next/image';

export default function TeamPage() {
  return (
    <main className="dashboardContainer">
      <h1 className="dashboardHeading">Meet the Team</h1>
      <div className="dashboardGrid container">
        {/* NICHOLAS */}
        <div className="team-member">
          <Image
            src="/images/nick.jpg"
            alt="Nicholas Muthoki"
            width={180}
            height={180}
            className="profile-image"
          />
          <h2 className="name">Nick Muthoki</h2>
          <p className="role">Founder & Developer</p>
          <p className="desc">
            End-to-end builder of Agrosight — from vision to model training to deployment.<br />
            Passionate about invisible intelligence for African farmers and building for social impact.
          </p>
          <ul className="contact-links">
            <li><a href="mailto:nicholasmuthoki@gmail.com" className="email-btn">Email</a></li>
            <li><a href="https://github.com/Nick-Maximillien" target="_blank">GitHub</a></li>
            <li><a href="https://www.linkedin.com/in/nicholas-muthoki-5642a7288" target="_blank">LinkedIn</a></li>
            <li><a href="https://nick-maximillien.netlify.app" target="_blank">Portfolio</a></li>
          </ul>
        </div>

        {/* MOSES */}
        <div className="team-member">
          <Image
            src="/images/zico.jpg"
            alt="Moses Zico"
            width={180}
            height={180}
            className="profile-image"
          />
          <h2 className="name">Moses Zico</h2>
          <p className="role">Blockchain Partner & Cofounder</p>
          <p className="desc">
            Driving Agrosight’s future blockchain integrations and digital asset logic.<br />
            Cofounder in spirit and execution, deeply aligned with the mission of digital dignity.
          </p>
          <ul className="contact-links">
            <li><a href="mailto:mosesszico@gmail.com" className="email-btn">Email</a></li>
            <li><a href="https://github.com/zico-hubb" target="_blank">GitHub</a></li>
            <li><a href="https://twitter.com/moseszico" target="_blank">X</a></li>
            <li><a href="https://zicoblocks.xyz" target="_blank">Portfolio</a></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
