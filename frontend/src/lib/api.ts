import { ApiResponse } from '../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await (await import('./supabase')).supabase.auth.getSession();
  return session?.access_token || null;
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('API Request Error:', error);
    return { success: false, error: 'Network error or server unreachable' };
  }
}
