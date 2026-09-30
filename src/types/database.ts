/**
 * Generated Supabase types for the Melo schema.
 *
 * Regenerate after changing a migration:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * (see supabase/README.md)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          melo_id: string;
          display_name: string;
          reading_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          melo_id: string;
          display_name: string;
          reading_language: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          melo_id?: string;
          display_name?: string;
          reading_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          user_one_id: string;
          user_two_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_one_id: string;
          user_two_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_one_id?: string;
          user_two_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_user_one_id_fkey';
            columns: ['user_one_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rooms_user_two_id_fkey';
            columns: ['user_two_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          original_text: string;
          translated_text: string | null;
          source_language: string;
          target_language: string;
          translation_status: 'pending' | 'translated' | 'failed' | 'skipped';
          created_at: string;
          delivered_at: string | null;
          read_at: string | null;
        };
        Insert: {
          id: string;
          room_id: string;
          sender_id: string;
          original_text: string;
          translated_text?: string | null;
          source_language: string;
          target_language: string;
          translation_status: 'pending' | 'translated' | 'failed' | 'skipped';
          created_at?: string;
          delivered_at?: string | null;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          sender_id?: string;
          original_text?: string;
          translated_text?: string | null;
          source_language?: string;
          target_language?: string;
          translation_status?: 'pending' | 'translated' | 'failed' | 'skipped';
          created_at?: string;
          delivered_at?: string | null;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      translation_status: 'pending' | 'translated' | 'failed' | 'skipped';
    };
    CompositeTypes: Record<never, never>;
  };
}

export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
