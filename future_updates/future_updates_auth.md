# Future Auth Updates

## Multi-account YouTube ownership support

- A single creator user may legitimately operate multiple YouTube accounts or channels for clipping, regional distribution, or niche audience segmentation.
- Future auth/account-linking work should support connecting multiple owned YouTube channels to one platform user.
- The ownership model should treat this as one user with many verified external channels, not as a duplicate-user edge case.
- When implemented, the connect flow should:
  - allow selecting from multiple channels returned by Google OAuth
  - support attaching more than one verified YouTube channel to the same creator account
  - store per-channel metadata and tokens separately
  - let the creator choose which connected channel is used for baseline rebuilding, campaign participation, and later verification flows
  - support disconnecting one linked channel without breaking the others
