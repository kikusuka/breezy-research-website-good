import React from 'react';
import { PublicLayout } from './PublicLayout';

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="mt-10 font-headline-md text-headline-md">{children}</h2>;
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mt-3 font-body-md text-body-md text-on-surface-variant">{children}</p>;

/**
 * Plain-language description of what this version of the code does.
 * Keep it in sync with the code, and have it reviewed before public launch: it is not legal advice.
 */
export const PrivacyPage: React.FC = () => (
  <PublicLayout>
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-headline-lg text-4xl">Privacy</h1>
      <P>This page describes how the current version of Breezy handles your data. Breezy is in early access, so details can change. We update this page when they do.</P>

      <H>What stays on your device</H>
      <P>Your theme choice, local chat and research history, notes and provider settings are kept in your browser’s storage. Clearing your browser data removes them.</P>

      <H>Your account</H>
      <P>Sign-in uses Firebase Authentication with Google or email and password. Breezy’s servers check your sign-in token to confirm who you are. Email and password accounts are asked to verify their address.</P>

      <H>Model keys</H>
      <P>Keys you enter are stored in your browser. Some requests go directly from your browser to your provider. Others pass through Breezy’s server so the provider can be reached; in that case the key is sent with that request. In this version the server code does not save keys to a database.</P>

      <H>Server storage and limits</H>
      <P>If server history is enabled, conversations saved to your account count toward a per-account limit, which you can see in Settings. When you reach it, new messages stop being saved to your account until you delete conversations or move to your own storage. Deleting a conversation removes it from Breezy’s database.</P>

      <H>Research and third parties</H>
      <P>A research run sends your question to the search provider you selected, then fetches public web pages. Your chosen model provider receives the text it needs to answer. Each of those services has its own privacy policy.</P>

      <H>Google Drive</H>
      <P>Drive access is separate from signing in. It is requested only if you choose to connect it, and you can revoke it from your Google account at any time.</P>

      <H>Questions</H>
      <P>Contact details will be added here before the public launch.</P>
    </article>
  </PublicLayout>
);
