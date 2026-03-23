'use client';
import Link from "next/link";

export default function Contact() {
  return (
    <div className="dashboardGrid container">
      <h2 className="contactTitle text-center mb-4">Contact Us</h2>

      <div className="row gy-4">
        <div className="col-md-6 contactDetails">
          <p><strong>Email:</strong> support@autobooks-ai.africa</p>
          <p><strong>Phone:</strong> +254 7411 34327</p>
        </div>

        <div className="col-md-6 contactForm">
          <input
            type="text"
            className="form-control contactInput"
            placeholder="Your Name"
          />
          <input
            type="email"
            className="form-control contactInput"
            placeholder="Your Email"
          />
          <textarea
            className="form-control contactInput"
            rows={4}
            placeholder="Your Message"
          />
        <div className="text-center mt-5">
          <p className="signupRedirect">
            <Link className="links" href="mailto:nicholasmuthoki@gmail.com">
              Send
            </Link>
          </p>
      </div>
        </div>
      </div>

      <div className="text-center mt-5">
          <p className="signupRedirect">
            <Link className="links" href="/">
              Home
            </Link>
          </p>
      </div>
    </div>
  );
}
