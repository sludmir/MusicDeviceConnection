import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import LiveSetPlayer from './LiveSetPlayer';

// Global "now playing" set player. Mounted once above the router so the
// minimized pip keeps playing as the user navigates between routes.
const SetPlayerContext = createContext({
  playingSet: null,
  playSet: () => {},
  closePlayer: () => {},
});

export function SetPlayerProvider({ theme = 'light', children }) {
  const [playingSet, setPlayingSet] = useState(null);

  const playSet = useCallback((set) => setPlayingSet(set || null), []);
  const closePlayer = useCallback(() => setPlayingSet(null), []);

  const value = useMemo(
    () => ({ playingSet, playSet, closePlayer }),
    [playingSet, playSet, closePlayer],
  );

  return (
    <SetPlayerContext.Provider value={value}>
      {children}
      {playingSet && (
        <LiveSetPlayer
          key={playingSet.id || playingSet.videoURL}
          set={playingSet}
          onClose={closePlayer}
          theme={theme}
        />
      )}
    </SetPlayerContext.Provider>
  );
}

export function useSetPlayer() {
  return useContext(SetPlayerContext);
}

export default SetPlayerProvider;
