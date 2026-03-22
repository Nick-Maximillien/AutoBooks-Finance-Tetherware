import {
  getTokensFromLocalStorage,
  refreshAccessTokenIfNeeded,
} from '../../utils/tokenUtils';

export interface CropDistribution {
  crop_type: string;
  count: number;
}

export interface MostDiagnosedCrop {
  crop_type: string; // 🟢 updated from farm__crop_type to crop_type
  count: number;
}

export interface LatestDiagnosis {
  farmer__name: string;
  timestamp: string;
  insight: string;
}

export interface DiagnosisTrendPoint {
  date: string; // e.g. "2025-07-15"
  count: number;
}

export interface FarmerGrowthPoint {
  week: string; // e.g. "2025-W28"
  count: number;
}

export interface ObserverStats {
  farmer_count: number;
  farm_count: number;
  diagnosis_count: number;
  drone_flying_count: number;
  drone_total: number;
  geo_coverage_count: number;
  crop_type_distribution: CropDistribution[];
  most_diagnosed_crops: MostDiagnosedCrop[];
  diagnosis_trend: DiagnosisTrendPoint[];
  farmer_growth: FarmerGrowthPoint[];
  latest_diagnoses: LatestDiagnosis[];
}

export async function fetchObserverStats(): Promise<ObserverStats> {
  const { accessToken, refreshToken } = getTokensFromLocalStorage();

  if (!accessToken || !refreshToken) {
    throw new Error('Missing tokens');
  }

  const validAccessToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

  const res = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/observer/stats/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${validAccessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch observer stats: ${res.status}`);
  }

  return res.json();
}
