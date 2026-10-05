import { staffPage } from "@/lib/me";
import { TodoPage } from "@/components/todos";

export const metadata = { title: "To-do" };

export default async function Todos() {
  return <TodoPage me={await staffPage()} assign />;
}
