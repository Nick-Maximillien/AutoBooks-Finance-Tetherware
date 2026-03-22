'use client'
import axios from "axios"
import { useAuth } from "context/AuthContext"
import { useState } from "react"

export default function StopDrone() {
    const { accessToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState('');
    
    const handleStopDrone = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/stop-drone/`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setResponse(res.data.detail || 'Drone scan stopped and data stored.');
        } catch (err) {
            console.error('Error stopping drone scan', err);
            setResponse('Failed to stop drone..');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <button 
               onClick={handleStopDrone}
               disabled={loading}
            >
                {loading ? 'Stopping Drone...' : 'Stop Drone & Store Data'}
            </button>
            {response && <p>{response}</p>}
        </div>
    );
}