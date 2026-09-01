const meetings = [
  { time: 'Today · 10:30', title: 'Product direction', project: 'Compass', status: '6 actions' },
  { time: 'Yesterday · 15:00', title: 'Design review', project: 'Tennis', status: 'Complete' },
  { time: 'Mon · 09:15', title: 'Weekly planning', project: 'Unfiled', status: '3 actions' },
]

const steps = [
  ['01', 'Meet detected', 'A small native control appears over Zoom, Teams, or Google Meet.'],
  ['02', 'Record locally', 'Microphone and system audio stay on your Windows or macOS computer.'],
  ['03', 'File with context', 'Notes inherit your project brief, recent decisions, and open actions.'],
]

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

export default function HomePage() {
  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Free Meet Notes home">
          <Mark />
          <span>free meet notes</span>
        </a>
        <div className="navLinks">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          <a className="navCta" href="https://github.com/akhilm2223/free-meet-notes">View source ↗</a>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="heroCopy">
          <div className="eyebrow"><span /> Private desktop agent · early build</div>
          <h1>Your meetings.<br /><em>Still yours.</em></h1>
          <p className="lede">
            A private meeting memory that records locally, understands the project behind the call,
            and turns conversation into notes you can actually use.
          </p>
          <div className="heroActions">
            <a className="primaryButton" href="#preview">See the product <span>↓</span></a>
            <span className="availability">Windows preview · macOS signing in progress</span>
          </div>
          <div className="trustRow" aria-label="Product promises">
            <span>No meeting bot</span>
            <span>Local audio</span>
            <span>Open-source foundation</span>
          </div>
        </div>

        <div className="heroVisual" id="preview">
          <div className="ambient ambientOne" />
          <div className="ambient ambientTwo" />

          <div className="recordPill">
            <div className="recordStatus">
              <span className="liveDot" />
              <div>
                <strong>Recording locally</strong>
                <small>Product direction · 18:42</small>
              </div>
            </div>
            <div className="pillControls">
              <button aria-label="Pause preview">Ⅱ</button>
              <button className="stop" aria-label="Stop preview">■</button>
            </div>
          </div>

          <div className="appFrame">
            <aside>
              <div className="miniBrand"><Mark /></div>
              <div className="sideIcon active" />
              <div className="sideIcon" />
              <div className="sideIcon" />
              <div className="sideIcon bottom" />
            </aside>
            <div className="appBody">
              <div className="appHeader">
                <div>
                  <small>MEETING LIBRARY</small>
                  <h2>Good afternoon, Akhil.</h2>
                </div>
                <button className="newMeeting"><span /> New recording</button>
              </div>

              <div className="contextStrip">
                <div className="contextProject"><span>C</span><div><small>ACTIVE PROJECT</small><strong>Compass</strong></div></div>
                <div><small>LAST MEETING</small><strong>2 days ago</strong></div>
                <div><small>OPEN ACTIONS</small><strong>6 items</strong></div>
                <div><small>RECENT CODE</small><strong>12 commits</strong></div>
              </div>

              <div className="meetingList">
                <div className="listLabel"><span>RECENT MEETINGS</span><span>VIEW ALL</span></div>
                {meetings.map((meeting, index) => (
                  <article className="meetingRow" key={meeting.title}>
                    <span className={`meetingGlyph glyph${index}`} />
                    <div className="meetingTitle"><strong>{meeting.title}</strong><small>{meeting.time}</small></div>
                    <span className="projectTag">{meeting.project}</span>
                    <span className="meetingStatus">{meeting.status}</span>
                    <span className="arrow">↗</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="principles" id="privacy">
        <div className="shell principlesGrid">
          <p className="sectionKicker">THE DIFFERENCE</p>
          <h2>Context in.<br />Clarity out.</h2>
          <p className="principlesCopy">
            Most recorders know what was said. Free Meet Notes is designed to know why it mattered—without
            sending your raw meeting audio to a hosted dashboard.
          </p>
          <div className="metric"><strong>0</strong><span>bots joining your call</span></div>
          <div className="metric"><strong>1</strong><span>local source of truth</span></div>
          <div className="metric"><strong>∞</strong><span>projects and contexts</span></div>
        </div>
      </section>

      <section className="how shell" id="how">
        <div className="howHeading">
          <p className="sectionKicker">HOW IT WORKS</p>
          <h2>Quietly present.<br />Useful afterward.</h2>
        </div>
        <div className="steps">
          {steps.map(([number, title, copy]) => (
            <article className="step" key={number}>
              <span>{number}</span>
              <div className="stepRule" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture">
        <div className="shell architectureInner">
          <div>
            <p className="sectionKicker">DESKTOP + WEB</p>
            <h2>The recorder lives<br />where the audio lives.</h2>
          </div>
          <div className="architectureFlow" aria-label="Free Meet Notes architecture">
            <div><small>YOUR COMPUTER</small><strong>Capture · Transcribe · Store</strong></div>
            <span className="flowArrow">→</span>
            <div className="optional"><small>OPTIONAL WEB COMPANION</small><strong>Encrypted notes · Team access</strong></div>
          </div>
          <p className="architectureNote">
            The hosted surface is optional. It will never replace the desktop agent for recording,
            and cloud sync will be opt-in before any meeting data leaves your machine.
          </p>
        </div>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#top"><Mark /><span>free meet notes</span></a>
        <p>Private by design. Open source by choice.</p>
        <p>Development preview · 2026</p>
      </footer>
    </main>
  )
}
