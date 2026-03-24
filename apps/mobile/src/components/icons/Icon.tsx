import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

export function FolderIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M1.66669 5C1.66669 3.61929 2.78598 2.5 4.16669 2.5H7.643C8.30604 2.5 8.94192 2.76339 9.41077 3.23223L10.1011 3.92259C10.2574 4.07887 10.4694 4.16667 10.6904 4.16667H15.8334C17.2141 4.16667 18.3334 5.28595 18.3334 6.66667V15C18.3334 16.3807 17.2141 17.5 15.8334 17.5H4.16669C2.78598 17.5 1.66669 16.3807 1.66669 15V5ZM4.16669 4.16667C3.70645 4.16667 3.33335 4.53976 3.33335 5V8.33333H16.6667V6.66667C16.6667 6.20643 16.2936 5.83333 15.8334 5.83333H10.6904C10.0273 5.83333 9.39145 5.56994 8.92261 5.1011L8.23225 4.41074C8.07597 4.25446 7.86401 4.16667 7.643 4.16667H4.16669ZM16.6667 10H3.33335V15C3.33335 15.4602 3.70645 15.8333 4.16669 15.8333H15.8334C16.2936 15.8333 16.6667 15.4602 16.6667 15V10Z"
        fill={color}
      />
    </Svg>
  );
}

export function FolderOpenIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M8.36575 5.00294C8.31789 5.00035 8.26519 5 8.08579 5H7.3C6.44342 5 5.86113 5.00078 5.41104 5.03755C4.97262 5.07337 4.74842 5.1383 4.59202 5.21799C4.2157 5.40974 3.90973 5.7157 3.71799 6.09202C3.6383 6.24842 3.57337 6.47263 3.53755 6.91104C3.50078 7.36113 3.5 7.94342 3.5 8.8V13.3338C4.10345 12.2477 4.92627 11.2786 6.03229 10.4584C6.46262 10.1392 6.97003 10 7.45416 10H19.4995C19.4981 9.54872 19.4929 9.20759 19.4738 8.92661C19.4487 8.55915 19.4031 8.36814 19.3478 8.23464C19.1448 7.74458 18.7554 7.35523 18.2654 7.15224C18.1319 7.09695 17.9409 7.0513 17.5734 7.02623C17.197 7.00054 16.7126 7 16 7L12.8908 7.00001C12.7448 7.00002 12.6347 7.00003 12.5259 6.99413C11.6159 6.94474 10.75 6.58609 10.0717 5.97756C9.99052 5.90478 9.91272 5.82696 9.80953 5.72375L9.7929 5.70711C9.66604 5.58025 9.62853 5.54323 9.59285 5.51123C9.25366 5.20696 8.82074 5.02764 8.36575 5.00294ZM21.4996 10H21.6958C23.2725 10 24.218 11.7333 23.3868 13.0603C22.2267 14.9122 21.6207 15.9779 21.2984 17.3273C20.8483 19.2122 19.3008 21 17.0719 21H7.25868C7.23455 21 7.21056 21 7.18669 21H6.07372C5.95032 21 5.8274 20.9941 5.70538 20.9825C5.54408 20.9762 5.3918 20.9675 5.24817 20.9558C4.68608 20.9099 4.16937 20.8113 3.68404 20.564C2.93139 20.1805 2.31947 19.5686 1.93597 18.816C1.68868 18.3306 1.59012 17.8139 1.54419 17.2518C1.49998 16.7106 1.49999 16.0463 1.5 15.2413V8.7587C1.49999 7.95373 1.49998 7.28937 1.54419 6.74818C1.59012 6.18608 1.68868 5.66938 1.93597 5.18404C2.31947 4.43139 2.93139 3.81947 3.68404 3.43598C4.16937 3.18869 4.68608 3.09012 5.24817 3.0442C5.78937 2.99998 6.45373 2.99999 7.2587 3L8.10922 3C8.25524 2.99999 8.36528 2.99997 8.47414 3.00588C9.38412 3.05527 10.25 3.41391 10.9283 4.02245C11.0095 4.09525 11.0873 4.17306 11.1905 4.27632L11.2071 4.2929C11.334 4.41975 11.3715 4.45678 11.4072 4.48878C11.7463 4.79305 12.1793 4.97237 12.6343 4.99706C12.6821 4.99966 12.7348 5 12.9142 5L16.0343 5C16.7041 4.99999 17.2569 4.99999 17.7095 5.03087C18.1788 5.06289 18.6129 5.13142 19.0307 5.30449C20.0108 5.71046 20.7895 6.48916 21.1955 7.46927C21.3686 7.88708 21.4371 8.32118 21.4691 8.79047C21.4925 9.1336 21.4982 9.53436 21.4996 10ZM17.0719 19C18.1001 19 19.0467 18.1456 19.3531 16.8627C19.7604 15.1572 20.5385 13.8397 21.691 12H7.45416C7.34602 12 7.26903 12.0312 7.22363 12.0648C5.55547 13.3019 4.68121 14.9804 4.2774 17.1283C4.11717 17.9806 4.77661 18.8636 5.82444 18.9857C6.20963 18.9996 6.68386 19 7.3 19H17.0719Z"
        fill={color}
      />
    </Svg>
  );
}

export function MenuIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 8a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"
        fill={color}
      />
    </Svg>
  );
}

export function SortAZIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color}>
      <Path d="M8 19V4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 8H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 10V6C20 4.89543 19.1046 4 18 4C16.8954 4 16 4.89543 16 6V10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 14H18.365C19.2886 14 19.7504 14 19.8853 14.2879C20.0201 14.5758 19.7245 14.9306 19.1332 15.6402L16.8668 18.3598C16.2755 19.0694 15.9799 19.4242 16.1147 19.7121C16.2496 20 16.7114 20 17.635 20H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 16C4 16 6.94596 20 8.00003 20C9.05411 20 12 16 12 16" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SortZAIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color}>
      <Path d="M16 18H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 20V16C20 14.8954 19.1046 14 18 14C16.8954 14 16 14.8954 16 16V20" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 7.99997C4 7.99997 6.94596 4.00001 8.00003 4C9.05411 3.99999 12 8 12 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 5V20" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 4H18.365C19.2886 4 19.7504 4 19.8853 4.28792C20.0201 4.57584 19.7245 4.93062 19.1332 5.64018L16.8668 8.35982C16.2755 9.06938 15.9799 9.42416 16.1147 9.71208C16.2496 10 16.7114 10 17.635 10H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GitCommitIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color}>
      <Path d="M7 19H13C15.8284 19 17.2426 19 18.1213 18.1213C19 17.2426 19 15.8284 19 13V10M19 10C19.7002 10 21.0085 11.9943 21.5 12.5M19 10C18.2998 10 16.9915 11.9943 16.5 12.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 7L5 17" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="5" cy="5" r="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="19" cy="5" r="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="5" cy="19" r="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CodeDiffIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" color={color}>
      <Path d="M5.9925 12V18M9 14.9925L3 14.9925" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 22H9" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13 22C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V10.6569C21 9.83935 21 9.4306 20.8478 9.06306C20.6955 8.69552 20.4065 8.40649 19.8284 7.82843L15.0919 3.09188C14.593 2.593 14.3436 2.34355 14.0345 2.19575C13.9702 2.165 13.9044 2.13772 13.8372 2.11401C13.5141 2 13.1614 2 12.4558 2C9.21082 2 7.58831 2 6.48933 2.88607C6.26732 3.06508 6.06508 3.26731 5.88608 3.48933C5.14374 4.41003 5.02332 5.69818 5.00378 8M14 2.5V3C14 5.82843 14 7.24264 14.8787 8.12132C15.7574 9 17.1716 9 20 9H20.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}