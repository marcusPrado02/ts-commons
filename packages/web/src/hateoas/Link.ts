/**
 * A hypermedia link following the HATEOAS (Hypermedia as the Engine of Application State) principle.
 */
export interface Link {
  /** The URL the link points to. */
  readonly href: string;
  /** Relation type — describes the nature of the link (e.g. "self", "collection"). */
  readonly rel: string;
  /** HTTP method to use when following this link (e.g. "GET", "POST"). */
  readonly method?: string;
  /** Human-readable label for the link. */
  readonly title?: string;
  /** Media type of the resource the link points to. */
  readonly type?: string;
}
