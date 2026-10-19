import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const books = sqliteTable("books", {
 id:text("id").primaryKey(),owner:text("owner").notNull(),data:text("data").notNull(),
 revision:integer("revision").notNull().default(0),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
}, table => [index("books_owner_idx").on(table.owner)]);
