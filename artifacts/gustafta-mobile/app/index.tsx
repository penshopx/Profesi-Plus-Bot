import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { View, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function IndexScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(home)/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
