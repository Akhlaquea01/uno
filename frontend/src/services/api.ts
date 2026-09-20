import type {
  CreateRoomRequest,
  CreateRoomResponse,
  CreateUserRequest,
  CreateUserResponse,
  HealthResponse,
  JoinPreflightResponse,
  RoomResultsResponse,
  UserStatsResponse,
} from '@uno/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request to ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  createUser: (body: CreateUserRequest) =>
    request<CreateUserResponse>('/users', { method: 'POST', body: JSON.stringify(body) }),

  userStats: (userId: string) => request<UserStatsResponse>(`/users/${userId}/stats`),

  createRoom: (body: CreateRoomRequest) =>
    request<CreateRoomResponse>('/rooms', { method: 'POST', body: JSON.stringify(body) }),

  joinPreflight: (roomCode: string) =>
    request<JoinPreflightResponse>(`/rooms/${roomCode}/join`, { method: 'POST' }),

  roomResults: (roomCode: string) => request<RoomResultsResponse>(`/rooms/${roomCode}/results`),
};
