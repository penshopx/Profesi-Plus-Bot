import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@/lib/api';

export default function HomeLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // Wire up the Bearer token getter so every API call is authenticated.
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="project-brain"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
