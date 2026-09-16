import { redirect } from 'next/navigation';

export default function MyJobsRedirect() {
  redirect('/jobs/post');
}
