import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

export function CopyLink({ url }: { url: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="flex items-center gap-2">
			<Input
				readOnly
				aria-label="Link"
				value={url.replace(/^https?:\/\//, "")}
				onFocus={(e) => e.currentTarget.select()}
				className="min-w-0 flex-1"
			/>
			<Button
				size="compact"
				variant="outline"
				onClick={async () => {
					await navigator.clipboard?.writeText(url);
					setCopied(true);
					window.setTimeout(() => setCopied(false), 2000);
				}}
			>
				{copied ? <CheckIcon /> : <CopyIcon />}
				{copied ? "Copied" : "Copy"}
			</Button>
		</div>
	);
}
