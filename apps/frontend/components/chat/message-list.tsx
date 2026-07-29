import { BotAvatar, UserAvatar } from "@/components/chat/chat-avatar";
import { EmptyState } from "@/components/chat/empty-state";
import { SourceBadges } from "@/components/chat/source-badges";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
	Message,
	MessageAvatar,
	MessageContent,
} from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";

export interface MessageData {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources?: string[];
}

interface MessageListProps {
	messages: MessageData[];
}

export function MessageList({ messages }: MessageListProps) {
	return (
		<MessageScrollerProvider autoScroll scrollPreviousItemPeek={64}>
			<MessageScroller className="flex-1">
				<MessageScrollerViewport className="max-w-3xl mx-auto py-8 px-4">
					<MessageScrollerContent>
						{messages.length === 0 && (
							<MessageScrollerItem>
								<EmptyState />
							</MessageScrollerItem>
						)}
						{messages.map((msg) => (
							<MessageScrollerItem
								key={msg.id}
								messageId={msg.id}
								scrollAnchor={msg.role === "user"}
							>
								<Message align={msg.role === "user" ? "end" : "start"}>
									<MessageAvatar>
										{msg.role === "user" ? <UserAvatar /> : <BotAvatar />}
									</MessageAvatar>
									<MessageContent>
										{msg.role === "user" && (
											<Bubble
												variant={msg.role === "user" ? "default" : "secondary"}
											>
												<BubbleContent className="rounded-2xl p-4 text-sm">
													{msg.content}
												</BubbleContent>
											</Bubble>
										)}
										{msg.role === "assistant" && (
											<pre className="whitespace-pre-wrap text-sm">
												{msg.content}
											</pre>
										)}
										{msg.sources && msg.sources.length > 0 && (
											<SourceBadges sources={msg.sources} />
										)}
									</MessageContent>
								</Message>
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton />
			</MessageScroller>
		</MessageScrollerProvider>
	);
}
