import { useEffect, useState } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "@utils/tokenUtils";


type BalanceSheet = {
    assets: number;
    liabilities: number;
    equity: number;
    period: string;
};

export default function BalanceSheetComponent() {
    const [data, setData] = useState<BalanceSheet | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const { accessToken, refreshToken } = getTokensFromLocalStorage();
                if (!accessToken || !refreshToken) throw new Error('Missing tokens');

                const token =await refreshAccessTokenIfNeeded(accessToken, refreshToken);
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/balance-sheet/`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) setData(await res.json());
            } catch (err) {
                console.error("Error fetching balance sheet:", err);
            } finally {
                setLoading(false)
            }
        }
        fetchData();
    }, []);

    if (loading) return <div>Loading...</div>
    if (!data) return <div>No data</div>
    console.log("Data:", data)


    return (
        <div>
            <h2>Balance sheet</h2>
            <table>
                <thead>
                    <tr>
                        <th>Amount Type</th>
                        <th>Amount(KSH)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Assets</td>
                        <td>{data.assets.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Liabilities</td>
                        <td>{data.liabilities.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Equity</td>
                        <td>{data.equity.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            <p>Period: {data.period}</p>
        </div>
    )
}