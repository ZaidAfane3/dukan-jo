import { TicketChat } from "@/components/diwan/TicketChat";

/* A bug report or an idea from the theme designer, as a conversation with the merchant. It is kept as a ticket (the same
   replies and statuses, components/diwan/TicketChat.tsx), but it lives here under Bugs and ideas, with its own title and
   back link; a support ticket opened here moves to /diwan/tickets/<number>. */
export default function FeedbackItemPage() {
  return <TicketChat area="feedback" />;
}
