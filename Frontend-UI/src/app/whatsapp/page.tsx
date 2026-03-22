"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DiagnoseOnWhatsapp = () => {
  const [hasJoined, setHasJoined] = useState(false);

  const whatsappNumber = process.env.NEXT_PUBLIC_TWILIO_WHATSAPP_NUMBER || "";
  const strippedNumber = whatsappNumber.replace("whatsapp:+", "");

  const joinPhrase = "join reach-bread";
  const joinMessage = encodeURIComponent(joinPhrase);
  const copilotMessage = encodeURIComponent("Hello AutoBooks AI, I want to manage my business finances.");

  const joinLink = `https://api.whatsapp.com/send?phone=${strippedNumber}&text=${joinMessage}`;
  const copilotLink = `https://api.whatsapp.com/send?phone=${strippedNumber}&text=${copilotMessage}`;

  // fallback if joinedAt is more than 72 hours ago
  const getCopilotLink = () => {
    const joined = localStorage.getItem("autobooks_whatsapp_joined") === "true";
    const joinedAt = parseInt(localStorage.getItem("autobooks_joined_at") || "0", 10);
    const now = Date.now();
    const seventyTwoHours = 72 * 60 * 60 * 1000;

    if (joined && now - joinedAt <= seventyTwoHours) {
      return copilotLink;
    } else {
      return joinLink;
    }
  };

  useEffect(() => {
    const joined = localStorage.getItem("autobooks_whatsapp_joined") === "true";
    const joinedAt = parseInt(localStorage.getItem("autobooks_joined_at") || "0", 10);
    const now = Date.now();
    const seventyTwoHours = 72 * 60 * 60 * 1000;

    if (joined && now - joinedAt <= seventyTwoHours) {
      setHasJoined(true);
    } else {
      // Expired or never joined
      setHasJoined(false);
      localStorage.removeItem("autobooks_whatsapp_joined");
      localStorage.removeItem("autobooks_joined_at");
    }
  }, []);

  const markAsJoined = () => {
    setHasJoined(true);
    localStorage.setItem("autobooks_whatsapp_joined", "true");
    localStorage.setItem("autobooks_joined_at", Date.now().toString());
  };

  return (
    <div className="aboutContainer webContainer">
      <div className="dashboardGrid container whatsapp-card">
        <h2 className="whatsapp-heading">Access AutoBooks AI on WhatsApp</h2>

        {!hasJoined ? (
          <div className="whatsapp-join">
            <p className="whatsapp-description">
              To activate your business copilot on WhatsApp, tap below and send this code:
            </p>

            <pre className="whatsapp-code">{joinPhrase}</pre>

            <a
              href={joinLink}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-button"
            >
              Use WhatsApp
              <figure className="whatsapp">
                <Image
                  className="dropbtn whatsapplogo"
                  src="/images/whatsapp.png"
                  alt="Menu"
                  width={30}
                  height={30}
                />
              </figure>
            </a>

            <p className="whatsapp-note">
              After joining, you can chat with AutoBooks AI to track expenses, 
              generate insights, and receive personalized business guidance in real time.
            </p>

            <button onClick={markAsJoined} className="whatsapp-already-joined">
              I’ve already joined
            </button>
          </div>
        ) : (
          <div className="whatsapp-diagnose">
            <p className="whatsapp-description">Ready to manage your business with AI?</p>
            <a
              href={getCopilotLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-button"
            >
              Open AutoBooks Copilot        
              <figure className="whatsapp">
                <Image
                  className="dropbtn whatsapplogo"
                  src="/images/whatsapp.png"
                  alt="Menu"
                  width={30}
                  height={30}
                />
              </figure>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnoseOnWhatsapp;
