'use client';
import React, { useState } from 'react';
import { useAuth } from 'context/AuthContext';

interface FarmFormData {
  name: string;
  crop_type: string;
  size_hectares: number;
  location: string;
}

export default function FarmForm() {
  const [formData, setFormData] = useState<FarmFormData>({
    name: '',
    crop_type: '',
    size_hectares: 0,
    location: '',
  });

  const [message, setMessage] = useState('');
  const { accessToken } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'size_hectares' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/create-farm/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      setMessage('✅ Farm created successfully!');
      setFormData({ name: '', crop_type: '', size_hectares: 0, location: '' });
    } else {
      setMessage('❌ Error creating farm');
    }
  };

  return (
    <form className="farmFormWrapper" onSubmit={handleSubmit}>
      <h2 className="farmFormHeading">Create Farm</h2>

      <label className="formLabel">Farm Name:</label>
      <input
        name="name"
        className="formInput"
        placeholder="Farm Name"
        value={formData.name}
        onChange={handleChange}
        required
      />

      <label className="formLabel">Crop Type:</label>
      <input
        name="crop_type"
        className="formInput"
        placeholder="Crop Type"
        value={formData.crop_type}
        onChange={handleChange}
        required
      />

      <label className="formLabel">Size in Hectares:</label>
      <input
        name="size_hectares"
        className="formInput"
        type="number"
        placeholder="Size (in Hectares)"
        value={formData.size_hectares}
        onChange={handleChange}
        required
      />

      <label className="formLabel">Location:</label>
      <input
        name="location"
        className="formInput"
        placeholder="Location"
        value={formData.location}
        onChange={handleChange}
        required
      />

      <button className="createFarmBtn" type="submit">Create your Farm</button>
      {message && <p className="formMessage">{message}</p>}
    </form>
  );
}
