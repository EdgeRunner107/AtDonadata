import axios from 'axios';

export const API_BASE_URL = 'https://toys-cyan.vercel.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
});

function assertSuccess(payload, fallbackMessage) {
  if (!payload || payload.success !== true) {
    throw new Error(payload?.message || payload?.error || fallbackMessage);
  }
}

export async function fetchAllWeflabData() {
  const response = await api.get('/weflab-data/all');
  const payload = response.data;

  assertSuccess(payload, '데이터를 불러오지 못했습니다.');

  return {
    rows: Array.isArray(payload.data) ? payload.data : [],
    total: Number(payload.count ?? payload.data?.length ?? 0),
  };
}

export async function fetchWeflabRounds() {
  const response = await api.get('/weflab-rounds');
  const payload = response.data;

  assertSuccess(payload, '회차를 불러오지 못했습니다.');

  return {
    rounds: Array.isArray(payload.data) ? payload.data : [],
    total: Number(payload.count ?? payload.data?.length ?? 0),
  };
}

export async function fetchWeflabDataByRound(round) {
  const response = await api.get('/weflab-data/all', {
    params: { round },
  });
  const payload = response.data;

  assertSuccess(payload, '데이터를 불러오지 못했습니다.');

  return {
    rows: Array.isArray(payload.data) ? payload.data : [],
    total: Number(payload.count ?? payload.data?.length ?? 0),
  };
}
