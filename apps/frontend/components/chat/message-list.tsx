import { BotAvatar, UserAvatar } from "@/components/chat/chat-avatar";
import { EmptyState } from "@/components/chat/empty-state";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { SourceBadges } from "@/components/chat/source-badges";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
	Message,
	MessageAvatar,
	MessageContent,
	MessageHeader,
} from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";

export interface SourceInfo {
	title: string;
	score: number;
}

export interface MessageData {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources?: SourceInfo[];
}

interface MessageListProps {
	messages: MessageData[];
	streaming?: boolean;
	onSuggestion?: (question: string) => void;
}

export function MessageList({
	messages,
	streaming = false,
	onSuggestion,
}: MessageListProps) {
	const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;

	return (
		<MessageScrollerProvider autoScroll scrollPreviousItemPeek={64}>
			<MessageScroller className="flex-1">
				<MessageScrollerViewport className="mx-auto w-full max-w-2xl px-4 py-8">
					<MessageScrollerContent>
						{messages.length === 0 && (
							<MessageScrollerItem className="my-auto">
								<EmptyState onSuggestion={onSuggestion} />
							</MessageScrollerItem>
						)}
						{messages.map((msg, index) => {
							const streamingThis =
								streaming && msg.role === "assistant" && msg.id === lastId;
							return (
								<MessageScrollerItem
									key={msg.id}
									messageId={msg.id}
									scrollAnchor={msg.role === "user"}
									className="fd-message-in"
									style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}
								>
									<Message align={msg.role === "user" ? "end" : "start"}>
										<MessageAvatar>
											{msg.role === "user" ? <UserAvatar /> : <BotAvatar />}
										</MessageAvatar>
										<MessageContent>
											<MessageHeader>
												{msg.role === "user" ? "You" : "Frontdesk"}
											</MessageHeader>
											<Bubble
												variant={msg.role === "user" ? "default" : "outline"}
											>
												<BubbleContent className="p-4 text-sm leading-relaxed">
													{msg.role === "user" ? (
														msg.content
													) : (
														<>
															<MarkdownContent content={msg.content} />
															{streamingThis && (
																<span
																	aria-hidden
																	className="fd-caret ml-0.5 inline-block h-4 w-1.5 rounded-sm bg-primary/60 align-text-bottom"
																/>
															)}
														</>
													)}
												</BubbleContent>
											</Bubble>
											{msg.sources && msg.sources.length > 0 && (
												<SourceBadges sources={msg.sources} />
											)}
										</MessageContent>
									</Message>
								</MessageScrollerItem>
							);
						})}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton />
			</MessageScroller>
		</MessageScrollerProvider>
	);
}
