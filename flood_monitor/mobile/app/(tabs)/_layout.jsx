import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { SirenManager } from '../../components/SirenManager';
import { AnnouncementNotifier } from '../../components/AnnouncementNotifier';
import { AlertNotifier } from '../../components/AlertNotifier';

function TabIcon({ name, label, focused }) {
  return (
    <View style={styles.tabItemContainer}>
      <View style={[
        styles.iconWrapper,
        focused && styles.iconWrapperFocused,
      ]}>
        <Ionicons
          name={name}
          size={focused ? 17 : 19}
          color={focused ? '#dc2626' : '#ffffff'}
        />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.7}
        style={[
          styles.tabLabel,
          focused ? styles.tabLabelFocused : styles.tabLabelUnfocused,
        ]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { user, token } = useAuthStore();
  if (!token && !user) {
    return <Redirect href="/(auth)/login" />;
  }
  const role = user?.role || 'CITIZEN';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isResponder = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'].includes(role);

  const sosTab = isAdmin
    ? { icon: 'business', label: 'Centers' }
    : { icon: 'shield-checkmark', label: 'SOS' };

  const contactsTab = isResponder
    ? { icon: 'radio', label: 'Backup' }
    : { icon: 'call', label: 'Contacts' };

  return (
    <>
      <SirenManager />
      <AnnouncementNotifier />
      <AlertNotifier />
      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}>
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="home" label="Home" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="notifications" label="Alerts" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="sos"
          options={isResponder ? {
            tabBarItemStyle: { display: 'none' },
          } : {
            tabBarIcon: ({ focused }) => (
              <TabIcon name={sosTab.icon} label={sosTab.label} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="map" label="Map" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="announcements"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="newspaper" label="News" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            tabBarItemStyle: { display: 'flex' },
            tabBarIcon: ({ focused }) => (
              <TabIcon name={contactsTab.icon} label={contactsTab.label} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="person" label="Profile" focused={focused} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#dc2626',
    borderRadius: 24,
    marginHorizontal: 8,
    marginBottom: Platform.OS === 'ios' ? 24 : 10,
    height: 64,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 2,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  tabItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 1,
  },
  iconWrapper: {
    width: 34,
    height: 26,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperFocused: {
    backgroundColor: '#ffffff',
  },
  tabLabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  tabLabelFocused: {
    fontWeight: '800',
    color: '#ffffff',
  },
  tabLabelUnfocused: {
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.9,
  },
});