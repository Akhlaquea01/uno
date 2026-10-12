import { render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrientationGate from '../src/components/OrientationGate';
import { useLandscapeLock } from '../src/hooks/useLandscapeLock';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn<[], boolean>(),
  lockLandscape: vi.fn<[], Promise<void>>(),
  unlock: vi.fn<[], Promise<void>>(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
  registerPlugin: () => ({ lockLandscape: mocks.lockLandscape, unlock: mocks.unlock }),
}));

function setViewport({ portrait, width }: { portrait: boolean; width: number }) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: portrait,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lockLandscape.mockResolvedValue(undefined);
  mocks.unlock.mockResolvedValue(undefined);
});

describe('useLandscapeLock', () => {
  it('locks landscape on mount and unlocks on unmount in the Android app', () => {
    mocks.isNativePlatform.mockReturnValue(true);

    const { unmount } = renderHook(() => useLandscapeLock());
    expect(mocks.lockLandscape).toHaveBeenCalledTimes(1);
    expect(mocks.unlock).not.toHaveBeenCalled();

    unmount();
    expect(mocks.unlock).toHaveBeenCalledTimes(1);
  });

  it('does nothing in the browser', () => {
    mocks.isNativePlatform.mockReturnValue(false);

    const { unmount } = renderHook(() => useLandscapeLock());
    unmount();

    expect(mocks.lockLandscape).not.toHaveBeenCalled();
    expect(mocks.unlock).not.toHaveBeenCalled();
  });

  it('survives the native plugin rejecting', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.lockLandscape.mockRejectedValue(new Error('not implemented'));
    mocks.unlock.mockRejectedValue(new Error('not implemented'));

    const { unmount } = renderHook(() => useLandscapeLock());
    unmount();
    await Promise.resolve();

    expect(mocks.lockLandscape).toHaveBeenCalled();
    expect(mocks.unlock).toHaveBeenCalled();
  });
});

describe('OrientationGate', () => {
  it('asks a small portrait browser to rotate', () => {
    mocks.isNativePlatform.mockReturnValue(false);
    setViewport({ portrait: true, width: 390 });

    render(<OrientationGate>table</OrientationGate>);

    expect(screen.getByText(/rotate your device/i)).toBeInTheDocument();
    expect(screen.queryByText('table')).not.toBeInTheDocument();
  });

  it('shows the table in landscape', () => {
    mocks.isNativePlatform.mockReturnValue(false);
    setViewport({ portrait: false, width: 844 });

    render(<OrientationGate>table</OrientationGate>);

    expect(screen.getByText('table')).toBeInTheDocument();
  });

  it('never shows the rotate prompt in the Android app, which locks landscape itself', () => {
    mocks.isNativePlatform.mockReturnValue(true);
    setViewport({ portrait: true, width: 390 });

    render(<OrientationGate>table</OrientationGate>);

    expect(screen.getByText('table')).toBeInTheDocument();
    expect(screen.queryByText(/rotate your device/i)).not.toBeInTheDocument();
  });
});
