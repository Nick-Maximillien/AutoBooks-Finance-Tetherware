'use client'

export default function OrderDroneButton({ token }: { token: string }) {
    const handleClick = async () => {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/deploy-drone/`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            alert('Drone deployed!');
        } catch (err) {
            console.error('Deployment failed:', err);
        }
    };

    return <button onClick={handleClick}>Start Drone Scan</button>;
}