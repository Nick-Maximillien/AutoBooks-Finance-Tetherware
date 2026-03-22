"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DiagnoseOnWhatsapp = () => {
  const [hasJoined, setHasJoined] = useState(false);

  const whatsappNumber = process.env.NEXT_PUBLIC_PERSONAL_WHATSAPP_NUMBER || "";
  const strippedNumber = whatsappNumber.replace("whatsapp:+", "");

  const joinPhrase = "";
  const joinMessage = encodeURIComponent(joinPhrase);
  const diagnosisMessage = encodeURIComponent("Hi Nick!");

  const joinLink = `https://api.whatsapp.com/send?phone=${strippedNumber}&text=${joinMessage}`;
  const diagnosisLink = `https://api.whatsapp.com/send?phone=${strippedNumber}&text=${diagnosisMessage}`;

  // fallback if joinedAt is more than 72 hours ago
  const getDiagnosisLink = () => {
    const joined = localStorage.getItem("agrosight_whatsapp_joined") === "true";
    const joinedAt = parseInt(localStorage.getItem("agrosight_joined_at") || "0", 10);
    const now = Date.now();
    const seventyTwoHours = 72 * 60 * 60 * 1000;

    if (joined && now - joinedAt <= seventyTwoHours) {
      return diagnosisLink;
    } else {
      return joinLink;
    }
  };

  useEffect(() => {
    const joined = localStorage.getItem("agrosight_whatsapp_joined") === "true";
    const joinedAt = parseInt(localStorage.getItem("agrosight_joined_at") || "0", 10);
    const now = Date.now();
    const seventyTwoHours = 72 * 60 * 60 * 1000;

    if (joined && now - joinedAt <= seventyTwoHours) {
      setHasJoined(true);
    } else {
      // Expired or never joined
      setHasJoined(false);
      localStorage.removeItem("agrosight_whatsapp_joined");
      localStorage.removeItem("agrosight_joined_at");
    }
  }, []);

  return (
    <div className="aboutContainer webContainer">
      <div className="dashboardGrid container whatsapp-card">
        <h2 className="whatsapp-heading">Chat via WhatsApp</h2>

        {!hasJoined ? (
          <div className="whatsapp-join">

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
              Message me on Whatsapp
            </p>
          </div>
        ) : (
          <div className="whatsapp-diagnose">
            <p className="whatsapp-description">Ready to talk about your project?</p>
            <a
              href={getDiagnosisLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-button"
            >
              Let us talk on Whatsapp         <figure className="whatsapp">
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
