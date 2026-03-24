import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React, { useState } from 'react';
import { useColorScheme, View, Pressable, Text } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <NativeTabs
          backgroundColor={colors.background}
          indicatorColor={colors.backgroundElement}
          labelStyle={{ selected: { color: colors.text } }}>
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }}
              md="chat"
            />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="explore">
            <NativeTabs.Trigger.Label>Git</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'point.3.connected.trianglepath.dotted', selected: 'point.3.filled.connected.trianglepath.dotted' }}
              md="account_tree"
            />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="diff">
            <NativeTabs.Trigger.Label>Diff</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'doc.text.magnifyingglass', selected: 'doc.text.magnifyingglass' }}
              md="difference"
            />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="pair">
            <NativeTabs.Trigger.Label hidden>Pair</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'qrcode', selected: 'qrcode' }}
              md="qr_code"
            />
          </NativeTabs.Trigger>
        </NativeTabs>
    </View>
  );
}
