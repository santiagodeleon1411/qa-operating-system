# Estoca

*(working name — rename anytime)*

Estoca is a SaaS that gives single-branch retail SMBs real-time control of their
stock: what they have, what moves in and out, and when they are about to run out.

## Language

**Merchant**:
A retail business that uses Estoca to manage its stock — the tenant and paying
customer. One Merchant = one account, single branch (for now).
_Avoid_: client, customer, store, shop, account, tenant.

**Staff**:
A person who works at a Merchant and uses Estoca (owner, cashier, stock clerk).
Distinct from the Merchant, which is the business itself.
_Avoid_: user, employee, account.

**Product**:
An item a Merchant stocks and sells, tracked as a single stock-keeping unit.
_Avoid_: SKU (internal identifier only), item, article, good.

**Stock**:
The quantity of a given Product currently on hand at the Merchant. A number that
must always reflect physical reality on the shelf.
_Avoid_: inventory (as the count), quantity, amount, units.

**Stock movement**:
A recorded event that changes Stock — an entry (received) or an exit (sold, lost,
adjusted). Stock is always the sum of its movements.
_Avoid_: transaction, operation. (An "adjustment" is one *type* of movement, not a synonym.)

**Stockout**:
The state of a Product whose Stock has reached, or dropped below, a Merchant-defined
threshold. The condition Estoca exists to warn about — ideally *before* it happens.
_Avoid_: out of stock (as a noun), shortage, rupture.

## Example dialogue

*A developer and a domain expert clarifying boundaries:*

— "When a cashier sells three units, is that a Stock movement or a Stockout?"
— "A Stock movement — an exit of three. It only becomes a Stockout if that exit
takes the Product's Stock at or below its threshold. A single sale can cause both:
the movement, and then the Stockout it triggers."
