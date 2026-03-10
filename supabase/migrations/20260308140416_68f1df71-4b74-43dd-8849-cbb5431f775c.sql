
-- Function to deduct stock when a sale is made
CREATE OR REPLACE FUNCTION public.deduct_stock_for_sale(
  _branch_id uuid,
  _product_id uuid,
  _quantity numeric,
  _reference_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _track boolean;
  _new_qty numeric;
BEGIN
  -- Check if product tracks inventory
  SELECT track_inventory INTO _track FROM products WHERE id = _product_id;
  IF _track IS NOT TRUE THEN
    RETURN -1; -- skip non-tracked products
  END IF;

  -- Decrement inventory
  UPDATE inventory
  SET quantity = quantity - _quantity,
      updated_at = now()
  WHERE product_id = _product_id AND branch_id = _branch_id
  RETURNING quantity INTO _new_qty;

  -- If no inventory row exists, create one with negative qty
  IF NOT FOUND THEN
    INSERT INTO inventory (product_id, branch_id, quantity)
    VALUES (_product_id, _branch_id, -_quantity)
    RETURNING quantity INTO _new_qty;
  END IF;

  -- Record stock movement
  INSERT INTO stock_movements (branch_id, product_id, quantity, movement_type, reference_id, reference_type, created_by)
  VALUES (_branch_id, _product_id, -_quantity, 'sale', _reference_id, 'transaction', auth.uid());

  RETURN _new_qty;
END;
$$;

-- Function to check low stock items for a branch
CREATE OR REPLACE FUNCTION public.check_low_stock(_branch_id uuid)
RETURNS TABLE(product_id uuid, product_name text, quantity numeric, min_stock integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT i.product_id, p.name AS product_name, i.quantity, p.min_stock
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  WHERE i.branch_id = _branch_id
    AND p.track_inventory = true
    AND i.quantity <= COALESCE(p.min_stock, 0)
  ORDER BY i.quantity ASC;
$$;

-- Enable realtime on inventory table
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
