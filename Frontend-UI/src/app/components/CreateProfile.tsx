'use client';
import React, { useState } from "react";
import axios, { AxiosError } from "axios";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "@utils/tokenUtils";

export default function CreateProfile() {
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError(null);

    // Strip spaces/dashes just in case they type "0712 345 678" before sending
    const cleanPhone = phone.replace(/[\s-]/g, '');

    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      if (!accessToken || !refreshToken) throw new Error("Missing tokens");

      const validToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

      const formData = new FormData();
      formData.append('phone', cleanPhone); // Send the sanitized number
      formData.append('address', address);
      if (image) formData.append('image', image);

      await axios.post(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/create-profile/`, formData, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage('✅ Profile created! WhatsApp Copilot activated.');
      setPhone('');
      setAddress('');
      setImage(null);
    } catch (err) {
      const axiosError = err as AxiosError;
      console.error('❌ Failed to create profile:', axiosError.message);
      setError('Failed to create profile');
    }
  };

  return (
    <form className="createProfileForm" onSubmit={handleSubmit}>
      
      {/* Explicitly tell the user this is for the AI */}
      <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '-8px', display: 'block' }}>
        WhatsApp Authentication Number
      </label>
      <input 
        type="tel"
        className="formInput"
        placeholder="e.g. 0712345678"
        minLength={9}
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)} 
      />
      
      <input 
        type="text"
        className="formInput"
        placeholder="Business Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)} 
      />
      
      <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '-8px', display: 'block' }}>
        Company Logo (Optional)
      </label>
      <input
        type="file"
        className="formInput"
        accept="image/*"
        onChange={(e) => setImage(e.target.files?.[0] || null)}
      />
      
      <button type="submit" className="submitButton">Create Profile</button>

      {message && <p className="successMessage">{message}</p>}
      {error && <p className="errorMessage">{error}</p>}
    </form>
  );
}