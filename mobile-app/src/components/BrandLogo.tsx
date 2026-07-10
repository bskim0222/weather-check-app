import { Image, View } from 'react-native';

import { styles } from '../styles/appStyles';

const koLogo = require('../../assets/brand/weathercheck-fixed/weathercheck-ko-fixed-logo.png');
const symbolLogo = require('../../assets/brand/weathercheck-fixed/weathercheck-symbol-fixed.png');

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <View style={styles.brandLogoWrap}>
      <Image
        source={compact ? symbolLogo : koLogo}
        style={compact ? styles.brandSymbolImage : styles.brandLogoImage}
        resizeMode="contain"
      />
    </View>
  );
}
