---
name: LearnLanguage Web
description: A learning adventure map paired with a quiet authoring workspace.
colors:
  ink: "#172033"
  muted: "#586579"
  surface: "#F7F8FB"
  surface-raised: "#FFFFFF"
  primary: "#5A48D6"
  primary-soft: "#EEEBFF"
  progress: "#E59B35"
  success: "#278D69"
  danger: "#B84D62"
typography:
  body:
    fontFamily: "Geist, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 450
    lineHeight: 1.55
rounded:
  control: "10px"
  surface: "14px"
  hero: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary: "primary"
  button-secondary: "secondary"
  surface-card: "surface"
---

# Design System: LearnLanguage Web

## Overview

**Creative North Star: "The Learning Trail and the Quiet Workshop"**

Learn gives a learner a visible route: the next useful action, completed waypoints, and evidence-based progress. Its playfulness is warm and purposeful, never childish or competitive. Studio uses the same family of type, color, and controls, but strips the trail metaphor away so authoring stays calm and precise.

**Key Characteristics:**

- A single indigo action color; amber only marks earned learning progress.
- Clear task hierarchy before decorative effect.
- Learn rewards real completion; Studio emphasizes reliable authoring state.
- Mobile adapts structure and touch size, rather than shrinking desktop controls.

## Colors

Indigo carries action and selection; amber is reserved for earned route progress; neutral surfaces remain cool and quiet.

### Primary
- **Trail Indigo:** Used for primary actions, current states, and keyboard focus.

### Secondary
- **Milestone Amber:** Used only for completed-route emphasis and earned moments.

### Neutral
- **Workshop Ink:** Used for readable text and Studio navigation.
- **Open Paper:** Used for page backgrounds and low-distraction work areas.

**The Evidence Rule.** Amber never represents an arbitrary score; it represents a completed lesson, an active route, or a real review state.

## Typography

**Display Font:** Geist (with system CJK fallbacks)
**Body Font:** Geist (with system CJK fallbacks)
**Label/Mono Font:** Geist Mono

**Character:** A single, legible product face keeps Chinese and English UI text coherent. Type hierarchy uses weight and space, not decorative display fonts.

### Hierarchy
- **Headline:** Semibold, 28–34px, used for a page's immediate task.
- **Title:** Semibold, 18–22px, used for sections and cards.
- **Body:** 16px, used for explanatory copy; measures stay readable.
- **Label:** 12px, medium weight, used for metadata and compact controls.

## Layout

Desktop keeps Learn's navigation visible and constrains content. Mobile becomes a thumb-friendly single-column trail with a bottom-safe navigation area. Studio retains denser panels but shares the same spacing scale.

## Elevation & Depth

Surfaces use tonal separation and one soft ambient shadow for raised task cards. Structural borders communicate grouping and state; shadows do not duplicate borders merely for decoration.

## Shapes

Primary surfaces are gently rounded (14–20px). Controls are tighter (10px). Progress nodes can be circular because they communicate route position; pills are reserved for compact state labels.

## Components

### Buttons
- **Shape:** Confident rounded rectangle (10px).
- **Primary:** Trail Indigo background with white text.
- **Hover / Focus:** Short color and transform feedback, plus a persistent visible focus ring.
- **Secondary:** Quiet surface with structural border; never visually competes with the current task.

### Cards / Containers
- **Corner Style:** Raised containers use 14px; feature route cards use 20px.
- **Background:** Open Paper at page level, raised white task surfaces.
- **Shadow Strategy:** One soft, cool ambient shadow only where hierarchy needs lift.

### Navigation
- Learn navigation exposes Today, Plan, Library, Review, and Settings. On mobile it becomes a reachable, safe-area-aware rail.
- Studio navigation remains task-oriented and non-gamified.

## Do's and Don'ts

### Do:
- **Do** show the next learning action before secondary statistics.
- **Do** use progress only when it is derived from saved learning evidence.
- **Do** preserve Learn/Studio terminology and their distinct purposes.

### Don't:
- **Don't** add leaderboards, hearts, artificial currency, or blocked learning.
- **Don't** use gradient text, noisy card grids, or decorative animations for routine tasks.
- **Don't** shrink body copy or touch controls below readable, usable sizes on mobile.
