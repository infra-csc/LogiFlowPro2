import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, AtSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Comment } from "@shared/schema";

interface CommentSectionProps {
  entityType: string;
  entityId: string;
}

interface User {
  id: string;
  username: string;
  name: string;
}

interface CommentWithAuthor extends Comment {
  author: User;
}

export function CommentSection({ entityType, entityId }: CommentSectionProps) {
  const [comment, setComment] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { data: comments = [], isLoading: isLoadingComments } = useQuery<CommentWithAuthor[]>({
    queryKey: ["/api/comments", entityType, entityId],
    enabled: !!entityType && !!entityId,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/mention-lookup"],
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/comments", {
        entityType,
        entityId,
        content,
      });
      if (!res.ok) {
        throw new Error("Failed to create comment");
      }
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/comments", entityType, entityId] });
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi publicado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o comentário.",
        variant: "destructive",
      });
    },
  });

  // Track cursor position for mention insertion
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const curPos = e.target.selectionStart;
    
    setComment(value);
    setCursorPosition(curPos);

    // Check if user is typing @mention
    const textBeforeCursor = value.slice(0, curPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionSearch("");
    }
  };

  const handleMentionSelect = (username: string) => {
    const textBeforeCursor = comment.slice(0, cursorPosition);
    const textAfterCursor = comment.slice(cursorPosition);
    
    // Replace the @mention text with the selected username
    const beforeMention = textBeforeCursor.replace(/@\w*$/, `@${username} `);
    const newText = beforeMention + textAfterCursor;
    
    setComment(newText);
    setShowMentions(false);
    setMentionSearch("");
    
    // Focus back to textarea
    textareaRef.current?.focus();
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = beforeMention.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    user.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      createCommentMutation.mutate(comment.trim());
    }
  };

  return (
    <div className="space-y-4" data-testid="comment-section">
      {/* Comment Input */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={comment}
                onChange={handleTextareaChange}
                placeholder="Adicione um comentário... Use @ para mencionar alguém"
                className="min-h-24 resize-none"
                data-testid="input-comment"
              />
              
              {/* Mention Autocomplete Dropdown */}
              {showMentions && filteredUsers.length > 0 && (
                <Card className="absolute bottom-full mb-1 w-full max-h-48 overflow-y-auto z-10 shadow-lg">
                  <CardContent className="p-2">
                    {filteredUsers.slice(0, 5).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleMentionSelect(user.username)}
                        className="w-full flex items-center gap-2 p-2 rounded hover-elevate active-elevate-2 text-left"
                        data-testid={`mention-option-${user.username}`}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {user.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">@{user.username}</div>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                <span>Use @ para mencionar usuários</span>
              </div>
              <Button
                type="submit"
                disabled={!comment.trim() || createCommentMutation.isPending}
                data-testid="button-submit-comment"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Comments List */}
      <div className="space-y-3">
        {isLoadingComments ? (
          <div className="text-center text-muted-foreground py-4">Carregando comentários...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </div>
        ) : (
          comments.map((c) => (
            <Card key={c.id} data-testid={`comment-${c.id}`}>
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {c.author.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{c.author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        @{c.author.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.createdAt), { 
                          addSuffix: true,
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {c.content}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
