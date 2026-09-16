import { redirect } from 'next/navigation';

export default function InboxRedirect() {
  redirect('/applications?tab=received');
}
