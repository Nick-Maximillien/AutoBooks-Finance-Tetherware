"use client";

import { useState } from "react";
import FarmForm from "./FarmForm";

export default function CreateFarmToggle() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="loginbtn">
      {!isOpen ? (
        <h3
          onClick={() => setIsOpen(true)}
          style={{ cursor: "pointer", color: "#007bff" }}
        >
          ➕ Hello Farmer, create your farm
        </h3>
      ) : (
        <>
          <h3
            onClick={() => setIsOpen(false)}
            style={{ cursor: "pointer", color: "crimson" }}
          >
            ❌ Cancel Farm Creation
          </h3>
          <FarmForm />
        </>
      )}
    </div>
  );
}
