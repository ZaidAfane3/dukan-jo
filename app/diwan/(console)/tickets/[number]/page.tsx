import { TicketChat } from "@/components/diwan/TicketChat";

/* A support ticket as a conversation with the merchant (components/diwan/TicketChat.tsx). A bug report or an idea opened
   here moves to /diwan/feedback/<number>. */
export default function TicketPage() {
  return <TicketChat area="tickets" />;
}
