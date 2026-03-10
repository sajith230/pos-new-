
CREATE OR REPLACE FUNCTION public.deduct_stock_for_sale(_branch_id uuid, _product_id uuid, _quantity numeric, _reference_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _track boolean;
  _new_qty numeric;
  _has_recipe boolean;
  _recipe record;
  _ing_track boolean;
  _ing_qty numeric;
BEGIN
  SELECT track_inventory INTO _track FROM products WHERE id = _product_id;
  IF _track IS NOT TRUE THEN
    RETURN -1;
  END IF;

  SELECT EXISTS(SELECT 1 FROM recipes WHERE product_id = _product_id) INTO _has_recipe;

  IF _has_recipe THEN
    FOR _recipe IN SELECT ingredient_id, quantity AS recipe_qty FROM recipes WHERE product_id = _product_id
    LOOP
      SELECT track_inventory INTO _ing_track FROM products WHERE id = _recipe.ingredient_id;
      IF _ing_track IS NOT TRUE THEN
        CONTINUE;
      END IF;

      UPDATE inventory
      SET quantity = quantity - (_recipe.recipe_qty * _quantity), updated_at = now()
      WHERE product_id = _recipe.ingredient_id AND branch_id = _branch_id
      RETURNING quantity INTO _ing_qty;

      IF NOT FOUND THEN
        INSERT INTO inventory (product_id, branch_id, quantity)
        VALUES (_recipe.ingredient_id, _branch_id, -(_recipe.recipe_qty * _quantity))
        RETURNING quantity INTO _ing_qty;
      END IF;

      INSERT INTO stock_movements (branch_id, product_id, quantity, movement_type, reference_id, reference_type, created_by, notes)
      VALUES (_branch_id, _recipe.ingredient_id, -(_recipe.recipe_qty * _quantity), 'sale', _reference_id, 'transaction', auth.uid(),
              'Auto-deducted as ingredient of product ' || _product_id);
    END LOOP;

    UPDATE inventory
    SET quantity = quantity - _quantity, updated_at = now()
    WHERE product_id = _product_id AND branch_id = _branch_id
    RETURNING quantity INTO _new_qty;

    IF NOT FOUND THEN
      INSERT INTO inventory (product_id, branch_id, quantity)
      VALUES (_product_id, _branch_id, -_quantity)
      RETURNING quantity INTO _new_qty;
    END IF;

    INSERT INTO stock_movements (branch_id, product_id, quantity, movement_type, reference_id, reference_type, created_by)
    VALUES (_branch_id, _product_id, -_quantity, 'sale', _reference_id, 'transaction', auth.uid());

    RETURN _new_qty;
  ELSE
    UPDATE inventory
    SET quantity = quantity - _quantity, updated_at = now()
    WHERE product_id = _product_id AND branch_id = _branch_id
    RETURNING quantity INTO _new_qty;

    IF NOT FOUND THEN
      INSERT INTO inventory (product_id, branch_id, quantity)
      VALUES (_product_id, _branch_id, -_quantity)
      RETURNING quantity INTO _new_qty;
    END IF;

    INSERT INTO stock_movements (branch_id, product_id, quantity, movement_type, reference_id, reference_type, created_by)
    VALUES (_branch_id, _product_id, -_quantity, 'sale', _reference_id, 'transaction', auth.uid());

    RETURN _new_qty;
  END IF;
END;
$function$;
