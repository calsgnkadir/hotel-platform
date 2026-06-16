#!/bin/bash
# FAZ D2 — Mor 'Royal Purple' -> Lacivert+Altin 'Hospitality Night' palet kaymasi.
# Inline JSX/CSS hardcoded hex ve rgba mor degerleri otomatik degistirir.
# Status renkleri (#fbbf24 amber, #ef4444 red, #22c55e green, #22d3ee cyan) korunur.

set -e
cd "$(dirname "$0")/../src"

# Hex degisimleri — koyu mor surface'lar
find . -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" \) \
  -not -path "./styles/tokens.css" -not -path "./components/__tests__/*" \
  -print0 | xargs -0 sed -i \
  -e 's/#0a0612/#0c1726/g' \
  -e 's/#0a0618/#0c1726/g' \
  -e 's/#15102e/#15243d/g' \
  -e 's/#1f1740/#1e3a5f/g' \
  -e 's/#1a1438/#15243d/g' \
  -e 's/#3b0764/#0c1726/g' \
  -e 's/#581c87/#0c1726/g' \
  -e 's/#4c1d95/#15243d/g' \
  -e 's/#6d28d9/#234a82/g' \
  -e 's/#7c3aed/#234a82/g' \
  -e 's/#6b21a8/#1e3a5f/g' \
  -e 's/#7e22ce/#234a82/g' \
  -e 's/#9333ea/#b8902d/g' \
  -e 's/#a855f7/#d4a853/g' \
  -e 's/#c084fc/#f7c43c/g' \
  -e 's/#d8b4fe/#fde9a5/g' \
  -e 's/#c4b5fd/#fde9a5/g' \
  -e 's/#a5b4fc/#8ba9d2/g' \
  -e 's/#e9d5ff/#dde7f3/g' \
  -e 's/#ede9fe/#dde7f3/g' \
  -e 's/#f3e8ff/#dde7f3/g' \
  -e 's/#fae8ff/#fef7d7/g' \
  -e 's/#d946ef/#d4a853/g' \
  -e 's/#e879f9/#f7c43c/g' \
  -e 's/#f0abfc/#fde9a5/g' \
  -e 's/#dddd6fe/#dde7f3/g' \
  -e 's/#faf5ff/#f1f5fb/g'

# RGBA degisimleri — mor accent rgba'lar -> altin/lacivert
find . -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" \) \
  -not -path "./styles/tokens.css" -not -path "./components/__tests__/*" \
  -print0 | xargs -0 sed -i -E \
  -e 's/rgba\(168, ?85, ?247,/rgba(212, 168, 83,/g' \
  -e 's/rgba\(107, ?33, ?168,/rgba(30, 58, 95,/g' \
  -e 's/rgba\(217, ?70, ?239,/rgba(212, 168, 83,/g' \
  -e 's/rgba\(124, ?58, ?237,/rgba(212, 168, 83,/g' \
  -e 's/rgba\(147, ?51, ?234,/rgba(184, 144, 45,/g' \
  -e 's/rgba\(126, ?34, ?206,/rgba(35, 74, 130,/g' \
  -e 's/rgba\(192, ?132, ?252,/rgba(247, 196, 60,/g' \
  -e 's/rgba\(216, ?180, ?254,/rgba(253, 233, 165,/g' \
  -e 's/rgba\(15, ?10, ?30,/rgba(15, 23, 38,/g' \
  -e 's/rgba\(20, ?14, ?38,/rgba(21, 36, 61,/g' \
  -e 's/rgba\(31, ?23, ?64,/rgba(30, 58, 95,/g' \
  -e 's/rgba\(59, ?7, ?100,/rgba(12, 23, 38,/g'

echo "Palet kaymasi tamam."
