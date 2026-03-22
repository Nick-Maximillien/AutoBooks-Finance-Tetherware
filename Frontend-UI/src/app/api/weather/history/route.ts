import { NextResponse } from 'next/server';
import axios from 'axios';

const WEATHER_HISTORY_API_URL = process.env.NEXT_PUBLIC_DJANGO_API_URL + '/weather/history/';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await axios.get(WEATHER_HISTORY_API_URL, {
      headers: {
        Authorization: authHeader,
      },
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching weather history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather history' },
      { status: 500 }
    );
  }
}
