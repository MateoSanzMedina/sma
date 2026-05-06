import { pgTable, serial, text, varchar, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

// Enums para roles y estados
export const roleEnum = pgEnum("role", ["admin", "director", "ventas", "cliente"]);
export const projectStatusEnum = pgEnum("project_status", ["planeacion", "preventa", "en-obra", "entregado"]);

// Tabla de Usuarios
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").default("cliente"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla de Proyectos
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("planeacion"),
  progress: integer("progress").default(0),
  totalUnits: integer("total_units").default(0),
  soldUnits: integer("sold_units").default(0),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla de Leads (CRM)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  source: varchar("source", { length: 100 }), // ej: Facebook, Web, Referido
  status: varchar("status", { length: 50 }).default("nuevo"),
  projectId: integer("project_id").references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow(),
});
