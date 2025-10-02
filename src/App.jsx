import React from "react";
import KaptainHumanizer from "./components/kaptainhumanizer.jsx";

export default function App() {
  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">JohnKaptain</div>
        <div className="chip">v0.1</div>
      </header>

      <main className="main">
        <p className="lede">
          Paste your AI text, press <strong>Humanize</strong>, and get a more
          natural rewrite. ✨
        </p>
        <KaptainHumanizer />
      </main>

      <footer className="site-footer">
        © {new Date().getFullYear()} JohnKaptain — Built with React
      </footer>
    </div>
  );
}
