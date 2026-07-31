export function relativeTime(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins= Math.floor(diffMs/ 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : "s"} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? ' ': "s"} ago`

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7 ) return `${diffDays} days ago`;

    return new Date(isoDate).toLocaleDateString('en-us', { month: 'short', day: 'numeric'})
}