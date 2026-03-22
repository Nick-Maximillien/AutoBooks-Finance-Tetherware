"use client";
import { useState, ChangeEvent, FormEvent } from "react";
import { getTokensFromLocalStorage } from "@utils/tokenUtils";

interface SingleResult {
  cloudinary_url: string;
  detection: string;
  insight?: string;
  error?: string;
}

export default function ImageUpload() {
  const [images, setImages] = useState<File[]>([]);
  const [results, setResults] = useState<SingleResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
      setResults([]);
      setError(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (images.length === 0) return;

    setLoading(true);
    setResults([]);
    setError(null);

    const { accessToken, refreshToken } = getTokensFromLocalStorage();
    const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;

    let profileName: string | null = null;
    let email: string | null = null;

    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        profileName = user?.username || null;
        email = user?.email || null;
      } catch (err) {
        console.error("Failed to parse localStorage.user:", err);
      }
    }

    const uploadPromises = images.map(async (image) => {
      const formData = new FormData();
      formData.append("image", image);
      if (profileName) formData.append("profile_name", profileName);
      if (email) formData.append("email", email);

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_FAST_API_URL}/copilot/`, {
          method: "POST",
          body: formData,
          headers: {
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...(refreshToken && { "X-Refresh-Token": refreshToken }),
          },
        });

        if (!res.ok) throw new Error(`Upload failed for ${image.name}`);
        const data = await res.json();
        const detection = extractClassName(data.raw_result);

        const result: SingleResult = {
          cloudinary_url: data.cloudinary_url,
          detection,
        };

        const insightRes = await fetch(`${process.env.NEXT_PUBLIC_FAST_API_URL}/generate_insight/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_result: data.raw_result }),
        });

        if (insightRes.ok) {
          const insightData = await insightRes.json();
          result.insight = insightData.insight || "No advice available.";
        } else {
          result.insight = "Advice generation failed.";
        }

        return result;
      } catch (err) {
        console.error(err);
        return {
          cloudinary_url: "",
          detection: "Unknown",
          insight: "",
          error: `Failed to process ${image.name}`,
        };
      }
    });

    const allResults = await Promise.all(uploadPromises);
    setResults(allResults);
    setLoading(false);
  };

  const extractClassName = (raw: string): string => {
    if (!raw) return "Unknown";
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].class_name) {
        return parsed[0].class_name;
      }
    } catch {
      if (typeof raw === "string") return raw;
    }
    return "Unknown";
  };

  return (
    <div className="uploadImage"
         style={{ backgroundImage: "url('/images/uploadBg.png')", color: "white" }}>
      <h2 className="analyses">Upload Crop images for AI analysis</h2>
      <p className="analyses">(chunguza na AI)</p>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          className="formInput"
          multiple
          accept="image/*"
          onChange={handleImageChange}
        />
        <button className="createFarmBtn" type="submit" disabled={images.length === 0 || loading}>
          {loading ? "Sending..." : "Send"}
        </button>
      </form>

      {error && <p className="errorText">{error}</p>}

      {results.length > 0 && (
        <div className="analysis">
          <h3>Analysis Results:</h3>
          {results.map((res, idx) => (
            <div key={idx} className="analysisResult">
              {res.error ? (
                <p className="errorText">{res.error}</p>
              ) : (
                <>
                  <p>
                    <strong>Image:</strong>{" "}
                    <a
                      href={res.cloudinary_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="uploadLink"
                    >
                      View on Cloudinary
                    </a>
                  </p>
                  <p>
                    <strong>Disease/Pest Detected:</strong> {res.detection}
                  </p>
                  <p>
                    <strong>Advice:</strong> {res.insight}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
