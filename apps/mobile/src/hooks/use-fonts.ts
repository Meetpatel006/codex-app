import { useEffect, useState } from "react";
import * as Font from "expo-font";

const FONTS = {
  "IBMPlexSans-Regular": require("../../assets/fonts/IBM_Plex_Sans/static/IBMPlexSans-Regular.ttf"),
  "IBMPlexSans-Medium": require("../../assets/fonts/IBM_Plex_Sans/static/IBMPlexSans-Medium.ttf"),
  "IBMPlexSans-SemiBold": require("../../assets/fonts/IBM_Plex_Sans/static/IBMPlexSans-SemiBold.ttf"),
  "IBMPlexSans-Bold": require("../../assets/fonts/IBM_Plex_Sans/static/IBMPlexSans-Bold.ttf"),
  "JetBrainsMono-Regular": require("../../assets/fonts/JetBrains_Mono/static/JetBrainsMono-Regular.ttf"),
  "JetBrainsMono-Medium": require("../../assets/fonts/JetBrains_Mono/static/JetBrainsMono-Medium.ttf"),
  "JetBrainsMono-Bold": require("../../assets/fonts/JetBrains_Mono/static/JetBrainsMono-Bold.ttf"),
  "SpaceGrotesk-Regular": require("../../assets/fonts/Space_Grotesk/static/SpaceGrotesk-Regular.ttf"),
  "SpaceGrotesk-Medium": require("../../assets/fonts/Space_Grotesk/static/SpaceGrotesk-Medium.ttf"),
  "SpaceGrotesk-SemiBold": require("../../assets/fonts/Space_Grotesk/static/SpaceGrotesk-SemiBold.ttf"),
  "SpaceGrotesk-Bold": require("../../assets/fonts/Space_Grotesk/static/SpaceGrotesk-Bold.ttf"),
};

export function useLoadFonts() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync(FONTS)
      .then(() => setIsLoaded(true))
      .catch(() => setIsLoaded(true));
  }, []);

  return isLoaded;
}
